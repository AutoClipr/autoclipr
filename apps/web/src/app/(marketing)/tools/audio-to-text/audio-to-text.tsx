"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Check, Copy, Download, FileAudio, FileText, Globe,
  Languages, Loader2, Mic, RotateCcw, ShieldCheck, Upload, Zap,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

type Stage = "idle" | "ready" | "decoding" | "loading-model" | "transcribing" | "done" | "error";
type Chunk = { start: number; end: number; text: string };

const MODELS = [
  { id: "onnx-community/whisper-base", label: "Accurate", note: "~80 MB, one-time" },
  { id: "onnx-community/whisper-tiny", label: "Fast", note: "~40 MB, one-time" },
];

const LANGUAGES: { code: string | null; label: string }[] = [
  { code: null, label: "Auto-detect" },
  { code: "english", label: "English" },
  { code: "hindi", label: "Hindi" },
  { code: "spanish", label: "Spanish" },
  { code: "french", label: "French" },
  { code: "german", label: "German" },
  { code: "portuguese", label: "Portuguese" },
  { code: "italian", label: "Italian" },
  { code: "japanese", label: "Japanese" },
  { code: "korean", label: "Korean" },
  { code: "chinese", label: "Chinese" },
  { code: "arabic", label: "Arabic" },
  { code: "russian", label: "Russian" },
  { code: "turkish", label: "Turkish" },
  { code: "indonesian", label: "Indonesian" },
];

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

/** Decode any audio/video file to 16 kHz mono samples, which Whisper expects. */
async function decodeWithBrowser(buf: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(buf);
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
    const a = decoded.getChannelData(0);
    const b = decoded.getChannelData(1);
    const mono = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) mono[i] = (a[i] + b[i]) / 2;
    return mono;
  } finally {
    void ctx.close();
  }
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

export function AudioToText() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(MODELS[0].id);
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

  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const downloads = useRef(new Map<string, { loaded: number; total: number }>());

  useEffect(() => () => workerRef.current?.terminate(), []);

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

  function getWorker() {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    }
    return workerRef.current;
  }

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
    downloads.current.clear();

    const worker = getWorker();
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "download") {
        downloads.current.set(m.file, { loaded: m.loaded, total: m.total });
        let loaded = 0;
        let total = 0;
        downloads.current.forEach((d) => {
          loaded += d.loaded;
          total += d.total;
        });
        setDownload(total ? Math.round((loaded / total) * 100) : 0);
      } else if (m.type === "ready") {
        setStage("transcribing");
      } else if (m.type === "done") {
        setText(String(m.text).trim());
        setChunks(m.chunks);
        setStage("done");
      } else if (m.type === "error") {
        setError(m.message);
        setStage("error");
      }
    };
    worker.postMessage({ type: "transcribe", audio, model, language }, [audio.buffer]);
  }

  function reset() {
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
    <div className="min-h-screen bg-[#07080f] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/20 to-emerald-500/10">
            <Mic className="h-7 w-7 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl">Audio to Text</h1>
              <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300">AI</span>
            </div>
            <p className="mt-1 text-sm text-white/50">
              Extract the spoken text from any audio or video file. Powered by Whisper, running entirely in your browser.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { icon: ShieldCheck, label: "100% Private" },
            { icon: Globe, label: "No Upload" },
            { icon: Languages, label: "Auto language detect" },
            { icon: FileText, label: "TXT · SRT" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-white/50">
              <Icon className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>

        {/* Drop zone */}
        {stage === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`mt-8 flex cursor-pointer flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed py-24 transition-all ${
              dragging ? "border-teal-400 bg-teal-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300">
              <Upload className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold">Drop an audio or video file here</p>
              <p className="mt-1 text-sm text-white/40">MP3, WAV, M4A, OGG, MP4, MOV, WebM, MKV…</p>
            </div>
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
        )}

        {stage !== "idle" && file && (
          <div className="mt-8 grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Left: file + settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
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

              <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Model</p>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        disabled={busy}
                        onClick={() => setModel(m.id)}
                        className={`rounded-lg px-2 py-2 text-left transition-colors disabled:opacity-60 ${
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
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-teal-400/60"
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
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] disabled:opacity-60"
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
            <div className="flex min-h-[26rem] flex-col rounded-2xl border border-white/[0.06] bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Transcript
                  {words > 0 && <span className="text-xs font-normal text-white/40">{words.toLocaleString()} words</span>}
                </div>
                {stage === "done" && (
                  <div className="flex items-center gap-2">
                    {chunks.length > 0 && (
                      <button
                        onClick={() => setShowTimes((v) => !v)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          showTimes ? "border-teal-400/50 bg-teal-500/15 text-teal-200" : "border-white/10 text-white/55 hover:text-white"
                        }`}
                      >
                        Timestamps
                      </button>
                    )}
                    <button onClick={copy} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button onClick={() => save("txt")} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
                      <Download className="h-3 w-3" /> TXT
                    </button>
                    {chunks.length > 0 && (
                      <button onClick={() => save("srt")} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white">
                        <Download className="h-3 w-3" /> SRT
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                {stage === "ready" && (
                  <div className="m-auto text-center text-sm text-white/40">
                    Pick a model and language, then click <span className="text-white">Extract text</span>.
                  </div>
                )}

                {busy && (
                  <div className="m-auto w-full max-w-sm text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-300" />
                    <p className="mt-4 text-sm font-medium">
                      {stage === "decoding" && "Reading the audio track…"}
                      {stage === "loading-model" && (download > 0 ? `Downloading model… ${download}%` : "Loading model…")}
                      {stage === "transcribing" && `Transcribing… ${fmtTime(elapsed)}`}
                    </p>
                    {stage === "loading-model" && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${download}%` }} />
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
                      className="min-h-[22rem] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-white/85 outline-none"
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
