"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Check, Copy, Download, FileAudio, FileText, Globe,
  Languages, Loader2, Mic, RotateCcw, ShieldCheck, Upload, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import {
  WHISPER_LANGUAGES as LANGUAGES,
  WHISPER_MODELS as MODELS,
  decodeTo16kMono as decodeWithBrowser,
  transcribeWithWhisper,
} from "@/lib/whisper/transcribe";

type Stage = "idle" | "ready" | "decoding" | "loading-model" | "transcribing" | "done" | "error";
type Chunk = { start: number; end: number; text: string };

const ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.mp4,.mov,.webm,.mkv,.avi,.m4v";

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function srtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

async function loadFFmpeg(): Promise<FFmpeg> {
  const ff = new FFmpeg();
  const base = "/ffmpeg";
  const OrigWorker = window.Worker;
  // Same shim the other tools use so ffmpeg.wasm loads from /public/ffmpeg.
  (window as unknown as { Worker: typeof Worker }).Worker = class extends OrigWorker {
    constructor(url: string | URL, opts?: WorkerOptions) {
      super(typeof url === "string" && url.includes("ffmpeg-core") ? `${base}/ffmpeg-worker.js` : url, {
        ...opts,
        type: "classic",
      });
    }
  };
  try {
    await ff.load({ coreURL: `${base}/ffmpeg-core-umd.js`, wasmURL: `${base}/ffmpeg-core-umd.wasm` });
  } finally {
    (window as unknown as { Worker: typeof Worker }).Worker = OrigWorker;
  }
  return ff;
}

/** Fallback for containers the browser can't decode (e.g. MKV, AVI). */
async function decodeWithFFmpeg(file: File): Promise<Float32Array> {
  const ff = await loadFFmpeg();
  const ext = file.name.split(".").pop() ?? "bin";
  await ff.writeFile(`in.${ext}`, await fetchFile(file));
  const ret = await ff.exec(["-y", "-i", `in.${ext}`, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "out.wav"]);
  if (ret !== 0) throw new Error("Couldn't read the audio track from this file.");
  const data = (await ff.readFile("out.wav")) as Uint8Array;
  ff.terminate();
  return decodeWithBrowser(data.slice().buffer as ArrayBuffer);
}

/** Animated equaliser bars shown while the model works. */
function Waveform() {
  return (
    <div className="flex h-14 items-center justify-center gap-1" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-teal-500 to-emerald-300"
          animate={{ height: [8, 18 + ((i * 37) % 34), 8] }}
          transition={{ duration: 0.9 + ((i * 13) % 7) / 10, repeat: Infinity, ease: "easeInOut", delay: (i % 6) * 0.08 }}
        />
      ))}
    </div>
  );
}

export function AudioToText() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [language, setLanguage] = useState<string | null>(null);
  const [download, setDownload] = useState(0);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [showTimes, setShowTimes] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const cancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  // Tick a timer while transcribing so long files don't look frozen.
  useEffect(() => {
    if (stage !== "transcribing") return;
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 500);
    return () => clearInterval(id);
  }, [stage]);

  const pick = (f: File) => {
    setFile(f);
    setStage("ready");
    setText("");
    setChunks([]);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  }, []);

  async function transcribe() {
    if (!file) return;
    setError("");
    setText("");
    setChunks([]);
    setElapsed(0);

    let audio: Float32Array;
    try {
      setStage("decoding");
      try {
        audio = await decodeWithBrowser(await file.arrayBuffer());
      } catch {
        audio = await decodeWithFFmpeg(file);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this file.");
      setStage("error");
      return;
    }
    setDuration(audio.length / 16000);

    setStage("loading-model");
    setDownload(0);

    const job = transcribeWithWhisper(audio, {
      model,
      language,
      onDownload: setDownload,
      onReady: () => setStage("transcribing"),
    });
    cancelRef.current = job.cancel;
    try {
      const res = await job.promise;
      setText(res.text);
      setChunks(res.chunks);
      setStage("done");
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      setError(e instanceof Error ? e.message : "Transcription failed.");
      setStage("error");
    } finally {
      cancelRef.current = null;
    }
  }

  function reset() {
    cancelRef.current?.();
    setStage("idle");
    setFile(null);
    setText("");
    setChunks([]);
    setError("");
  }

  const timestamped = chunks.map((c) => `[${fmtTime(c.start)}] ${c.text.trim()}`).join("\n");
  const output = showTimes && chunks.length ? timestamped : text;
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const baseName = file?.name.replace(/\.[^.]+$/, "") ?? "transcript";

  function save(kind: "txt" | "srt") {
    const content =
      kind === "srt"
        ? chunks.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text.trim()}`).join("\n\n")
        : output;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download = `${baseName}.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const busy = stage === "decoding" || stage === "loading-model" || stage === "transcribing";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(20,184,166,0.22), transparent 70%), radial-gradient(30% 40% at 15% 10%, rgba(16,185,129,0.14), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl">
        {/* Header */}
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mx-auto mb-10 mt-8 max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-400/30 bg-gradient-to-br from-teal-500/30 to-emerald-500/15 shadow-[0_0_40px_-8px_rgba(20,184,166,0.7)]">
            <Mic className="h-8 w-8 text-teal-200" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Audio to{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">Text</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
            Pull every spoken word out of any audio or video file. Powered by Whisper AI, running entirely in your browser.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: ShieldCheck, label: "100% Private" },
              { icon: Globe, label: "No Upload" },
              { icon: Languages, label: "Auto language detect" },
              { icon: FileText, label: "TXT · SRT" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur">
                <Icon className="h-3.5 w-3.5 text-teal-300" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        {stage === "idle" && (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`group relative mx-auto max-w-4xl cursor-pointer overflow-hidden rounded-[2rem] border p-2 transition-all duration-300 ${
                dragging
                  ? "border-teal-400/70 shadow-[0_0_60px_-10px_rgba(20,184,166,0.7)]"
                  : "border-white/10 hover:border-teal-400/40 hover:shadow-[0_0_60px_-16px_rgba(20,184,166,0.6)]"
              }`}
            >
              <div
                className={`relative flex flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-dashed px-6 py-20 transition-colors ${
                  dragging ? "border-teal-400/60 bg-teal-500/10" : "border-white/10 bg-white/[0.02] group-hover:bg-white/[0.035]"
                }`}
              >
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/15 blur-3xl" aria-hidden />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-teal-500/25 to-emerald-500/10 text-teal-200 transition-transform duration-300 group-hover:-translate-y-1">
                  <Upload className="h-9 w-9" />
                </div>
                <div className="relative text-center">
                  <p className="text-xl font-bold">Drop an audio or video file here</p>
                  <p className="mt-1.5 text-sm text-white/45">or click to browse · MP3, WAV, M4A, OGG, MP4, MOV, WebM, MKV…</p>
                </div>
                <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)] transition-shadow group-hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.65)]">
                  <Upload className="h-4 w-4" /> Choose a file
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pick(f);
                  }}
                />
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Upload", d: "Any audio or video file. It never leaves your device." },
                { n: "2", t: "Transcribe", d: "Whisper AI listens and writes out every word." },
                { n: "3", t: "Copy or export", d: "Edit the text, add timestamps, save TXT or SRT." },
              ].map((x) => (
                <div key={x.n} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-200">{x.n}</span>
                  <div>
                    <p className="text-sm font-semibold">{x.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">{x.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {stage !== "idle" && file && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Left: file + settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-white/40">
                    {fmtBytes(file.size)}
                    {duration > 0 && ` · ${fmtTime(duration)}`}
                  </p>
                </div>
              </div>

              <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Model</p>
                  <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-black/30 p-1">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        disabled={busy}
                        onClick={() => setModel(m.id)}
                        className={`rounded-xl px-3 py-2 text-left transition-all disabled:opacity-60 ${
                          model === m.id ? "bg-white text-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{m.label}</span>
                        <span className={`block text-[10px] ${model === m.id ? "text-black/55" : "text-white/35"}`}>{m.note}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="att-lang" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/40">
                    Spoken language
                  </label>
                  <select
                    id="att-lang"
                    disabled={busy}
                    value={language ?? ""}
                    onChange={(e) => setLanguage(e.target.value || null)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-teal-400/60"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.label} value={l.code ?? ""} className="bg-[#0b0d14]">
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={transcribe}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {stage === "done" ? "Transcribe again" : busy ? "Working…" : "Extract text"}
                </button>
                <button
                  onClick={reset}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" /> Choose another file
                </button>
              </div>
              <p className="px-1 text-xs leading-relaxed text-white/35">
                The model downloads once and is cached by your browser. Your file never leaves this device.
              </p>
            </div>

            {/* Right: transcript */}
            <div className="flex min-h-[28rem] flex-col rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Transcript
                  {words > 0 && (
                    <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-200">
                      {words.toLocaleString()} words · ~{Math.max(1, Math.round(words / 200))} min read
                    </span>
                  )}
                </div>
                {stage === "done" && (
                  <div className="flex items-center gap-2">
                    {chunks.length > 0 && (
                      <button
                        onClick={() => setShowTimes((v) => !v)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          showTimes ? "border-teal-400/50 bg-teal-500/15 text-teal-200" : "border-white/10 text-white/55 hover:text-white"
                        }`}
                      >
                        Timestamps
                      </button>
                    )}
                    <button onClick={copy} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/25 hover:text-white">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button onClick={() => save("txt")} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_20px_-6px_rgba(255,255,255,0.5)]">
                      <Download className="h-3 w-3" /> TXT
                    </button>
                    {chunks.length > 0 && (
                      <button onClick={() => save("srt")} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/25 hover:text-white">
                        <Download className="h-3 w-3" /> SRT
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                {stage === "ready" && (
                  <div className="m-auto flex flex-col items-center text-center text-sm text-white/40">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <FileText className="h-6 w-6 text-teal-300/70" />
                    </span>
                    Pick a model and language, then click <span className="text-white">Extract text</span>.
                  </div>
                )}

                {busy && (
                  <div className="m-auto w-full max-w-sm text-center">
                    <Waveform />
                    <p className="mt-5 text-sm font-semibold">
                      {stage === "decoding" && "Reading the audio track…"}
                      {stage === "loading-model" && (download > 0 ? `Downloading model… ${download}%` : "Loading model…")}
                      {stage === "transcribing" && `Transcribing… ${fmtTime(elapsed)}`}
                    </p>
                    {stage === "loading-model" && (
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.8)] transition-all" style={{ width: `${download}%` }} />
                      </div>
                    )}
                    {stage === "transcribing" && (
                      <p className="mt-2 text-xs text-white/40">
                        Long files can take a while. Keep this tab open.
                      </p>
                    )}
                  </div>
                )}

                {stage === "error" && (
                  <div className="m-auto flex max-w-sm flex-col items-center text-center">
                    <AlertCircle className="h-8 w-8 text-rose-400" />
                    <p className="mt-3 text-sm text-rose-200">{error}</p>
                  </div>
                )}

                {stage === "done" &&
                  (text ? (
                    <textarea
                      value={output}
                      onChange={(e) => {
                        setShowTimes(false);
                        setText(e.target.value);
                      }}
                      spellCheck={false}
                      className="scrollbar-slim min-h-[22rem] flex-1 resize-none bg-transparent pr-3 text-[15px] leading-relaxed text-white/85 outline-none"
                    />
                  ) : (
                    <p className="m-auto text-sm text-white/40">No speech was detected in this file.</p>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
