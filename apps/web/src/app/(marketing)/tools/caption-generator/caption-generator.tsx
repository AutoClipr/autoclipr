"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, Download, FileVideo, Zap, ShieldCheck, Globe,
  Captions, CheckCircle, AlertCircle, Loader2, Play, Pause,
  X, Settings2, ChevronDown, Mic, FileText, Clock, Languages,
  Copy, Check, Edit3, Save, Trash2, Plus, Volume2,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import {
  WHISPER_LANGUAGES,
  WHISPER_MODELS,
  decodeTo16kMono,
  transcribeWithWhisper,
  type WhisperChunk,
} from "@/lib/whisper/transcribe";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "ready" | "extracting" | "transcribing" | "done" | "error";

interface CaptionEntry {
  id: string;
  start: number;  // seconds
  end: number;
  text: string;
  editing?: boolean;
}

interface TranscribeOpts {
  model: string;
  language: string | null; // null → auto-detect
  maxLineLength: number;
  maxLineDuration: number;
  punctuation: boolean;
}

const DEFAULT_OPTS: TranscribeOpts = {
  model: WHISPER_MODELS[0].id,
  language: null,
  maxLineLength: 42,
  maxLineDuration: 5,
  punctuation: true,
};

// ─── Format helpers ───────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function toSrtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function toVttTime(s: number): string {
  return toSrtTime(s).replace(",", ".");
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function buildSrt(captions: CaptionEntry[]): string {
  return captions.map((c, i) =>
    `${i + 1}\n${toSrtTime(c.start)} --> ${toSrtTime(c.end)}\n${c.text}`
  ).join("\n\n");
}

function buildVtt(captions: CaptionEntry[]): string {
  const body = captions.map(c =>
    `${toVttTime(c.start)} --> ${toVttTime(c.end)}\n${c.text}`
  ).join("\n\n");
  return `WEBVTT\n\n${body}`;
}

function buildTxt(captions: CaptionEntry[]): string {
  return captions.map(c => `[${fmtTime(c.start)}] ${c.text}`).join("\n");
}

function wrapText(text: string, maxLen: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxLen && cur) {
      lines.push(cur.trim()); cur = w;
    } else { cur = (cur + " " + w).trim(); }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

// ─── Whisper chunks → caption lines ──────────────────────────────────────────

/**
 * Whisper returns sentence-ish chunks. Split any chunk longer than the max
 * segment duration into evenly timed pieces by word count, then wrap lines.
 */
function chunksToCaptions(chunks: WhisperChunk[], opts: TranscribeOpts): CaptionEntry[] {
  const out: CaptionEntry[] = [];
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text) continue;
    const start = c.start;
    const end = Math.max(c.end, start + 0.5);
    const dur = end - start;
    const parts = Math.max(1, Math.ceil(dur / opts.maxLineDuration));
    const words = text.split(/\s+/);
    const per = Math.ceil(words.length / parts);
    const n = Math.ceil(words.length / per);
    for (let i = 0; i < n; i++) {
      const piece = words.slice(i * per, (i + 1) * per).join(" ");
      out.push({
        id: uid(),
        start: start + (dur * i) / n,
        end: start + (dur * (i + 1)) / n,
        text: wrapText(piece, opts.maxLineLength),
      });
    }
  }
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CaptionGenerator() {
  const [stage, setStage]             = useState<Stage>("idle");
  const [file, setFile]               = useState<File | null>(null);
  const [videoUrl, setVideoUrl]       = useState<string | null>(null);
  const [audioUrl, setAudioUrl]       = useState<string | null>(null);
  const [duration, setDuration]       = useState(0);
  const [captions, setCaptions]       = useState<CaptionEntry[]>([]);
  const [opts, setOpts]               = useState<TranscribeOpts>(DEFAULT_OPTS);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]             = useState("");
  const [dragging, setDragging]       = useState(false);
  const [showOpts, setShowOpts]       = useState(false);
  const [copied, setCopied]           = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [editText, setEditText]       = useState("");
  const [wordCount, setWordCount]     = useState(0);

  const ffmpegRef  = useRef<FFmpeg | null>(null);
  const ffLoaded   = useRef(false);
  const fileRef    = useRef<HTMLInputElement>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const stopRef    = useRef<(() => void) | null>(null);
  const listRef    = useRef<HTMLDivElement>(null);

  const ACCEPT = "video/*,audio/*,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.m4v,.3gp,.ts,.mts,.mp3,.m4a,.wav";

  const setOpt = <K extends keyof TranscribeOpts>(k: K, v: TranscribeOpts[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  // ── FFmpeg loader ──
  const loadFFmpeg = useCallback(async () => {
    if (ffLoaded.current) return ffmpegRef.current!;
    const ff = new FFmpeg();
    const baseURL = "/ffmpeg";
    const workerURL = `${baseURL}/ffmpeg-worker.js`;
    const coreURL   = `${baseURL}/ffmpeg-core-umd.js`;
    const wasmURL   = `${baseURL}/ffmpeg-core-umd.wasm`;
    const OrigWorker = window.Worker;
    (window as any).Worker = class extends OrigWorker {
      constructor(url: string | URL, opts?: WorkerOptions) {
        super(typeof url === "string" && url.includes("ffmpeg-core") ? workerURL : url, { ...opts, type: "classic" });
      }
    };
    await ff.load({ coreURL, wasmURL });
    (window as any).Worker = OrigWorker;
    ffmpegRef.current = ff;
    ffLoaded.current  = true;
    return ff;
  }, []);

  // ── File pick ──
  const pickFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setStage("ready");
    setCaptions([]);
    setError("");
    setAudioUrl(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  // ── Video time tracking ──
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
  }, [videoUrl]);

  // ── Auto-scroll captions to active ──
  useEffect(() => {
    if (captions.length === 0) return;
    const active = captions.find(c => currentTime >= c.start && currentTime <= c.end);
    if (!active) return;
    const el = document.getElementById(`cap-${active.id}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentTime, captions]);

  // ── Extract audio ──
  const extractAudio = async (f: File): Promise<string> => {
    setProgressMsg("Loading FFmpeg…");
    const ff = await loadFFmpeg();
    const ext = f.name.split(".").pop() ?? "mp4";
    const inName = `input.${ext}`;
    setProgressMsg("Reading file…");
    await ff.writeFile(inName, await fetchFile(f));
    setProgressMsg("Extracting audio…");
    try { await ff.deleteFile("audio.wav"); } catch { /* ok */ }
    // Extract as 16kHz mono WAV — optimal for speech recognition
    const ret = await ff.exec(["-y", "-i", inName, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "audio.wav"]);
    if (ret !== 0) throw new Error("Could not extract audio from this file.");
    const data = await ff.readFile("audio.wav") as Uint8Array;
    try { await ff.deleteFile(inName); await ff.deleteFile("audio.wav"); } catch { /* ok */ }
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  };

  // ── Generate captions ──
  const generate = async () => {
    if (!file) return;
    setStage("extracting");
    setProgress(5);
    setCaptions([]);
    setError("");

    try {
      const aUrl = await extractAudio(file);
      setAudioUrl(aUrl);
      const samples = await decodeTo16kMono(await (await fetch(aUrl)).arrayBuffer());
      setProgress(25);
      setProgressMsg("Loading Whisper AI model…");

      const job = transcribeWithWhisper(samples, {
        model: opts.model,
        language: opts.language,
        onDownload: (pct) => {
          setProgressMsg(`Downloading Whisper model… ${pct}% (one-time)`);
          setProgress(25 + Math.round(pct * 0.35));
        },
        onReady: () => {
          setStage("transcribing");
          setProgress(65);
          setProgressMsg("Transcribing with Whisper AI…");
        },
      });
      stopRef.current = job.cancel;

      const res = await job.promise;
      const caps = chunksToCaptions(res.chunks, opts);
      setCaptions(caps);
      setWordCount(caps.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0));
      setProgress(100);
      setStage("done");
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "cancelled") return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
    } finally {
      stopRef.current = null;
    }
  };

  const stopTranscription = () => {
    stopRef.current?.();
    setStage("ready");
  };

  // ── Export ──
  const exportFile = (format: "srt" | "vtt" | "txt") => {
    if (captions.length === 0) return;
    const content = format === "srt" ? buildSrt(captions) : format === "vtt" ? buildVtt(captions) : buildTxt(captions);
    const mime = format === "txt" ? "text/plain" : "text/plain";
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file?.name.replace(/\.[^.]+$/, "") ?? "captions"}.${format}`;
    a.click();
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(buildTxt(captions));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Caption editing ──
  const startEdit = (c: CaptionEntry) => { setEditId(c.id); setEditText(c.text); };
  const saveEdit = (id: string) => {
    setCaptions(cs => cs.map(c => c.id === id ? { ...c, text: editText } : c));
    setEditId(null);
  };
  const deleteCaption = (id: string) => setCaptions(cs => cs.filter(c => c.id !== id));
  const seekTo = (t: number) => { const v = videoRef.current; if (v) { v.currentTime = t; v.play(); } };

  const reset = () => {
    stopRef.current?.();
    setStage("idle"); setFile(null); setVideoUrl(null); setAudioUrl(null);
    setCaptions([]); setError(""); setProgress(0);
  };

  const activeCap = captions.find(c => currentTime >= c.start && currentTime <= c.end);
  const isAudio = file?.type.startsWith("audio/");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(99,102,241,0.22), transparent 70%), radial-gradient(30% 40% at 85% 10%, rgba(16,185,129,0.12), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl">

        {/* ── Header ── */}
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mx-auto mb-10 mt-8 max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/30 to-purple-500/20 shadow-[0_0_40px_-8px_rgba(99,102,241,0.7)]">
            <Captions className="h-8 w-8 text-indigo-200" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            AI Caption{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Generator</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
            Drop a video and get accurate, timed captions in minutes. Edit inline, then export SRT, VTT or TXT.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "100% Private" },
              { icon: <Globe       className="h-3.5 w-3.5" />, label: "No Upload" },
              { icon: <Languages   className="h-3.5 w-3.5" />, label: "Whisper AI · 99 languages" },
              { icon: <FileText    className="h-3.5 w-3.5" />, label: "SRT · VTT · TXT" },
            ].map(p => (
              <span key={p.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur">
                <span className="text-indigo-300">{p.icon}</span>{p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Drop zone ── */}
        {stage === "idle" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`group relative mx-auto max-w-4xl cursor-pointer overflow-hidden rounded-[2rem] border p-2 transition-all duration-300
              ${dragging ? "border-indigo-400/70 shadow-[0_0_60px_-10px_rgba(99,102,241,0.7)]" : "border-white/10 hover:border-indigo-400/40 hover:shadow-[0_0_60px_-16px_rgba(99,102,241,0.6)]"}`}
          >
            <div className={`relative flex flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-dashed px-6 py-20 transition-colors
              ${dragging ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 bg-white/[0.02] group-hover:bg-white/[0.035]"}`}>
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/25 to-purple-500/10 text-indigo-200 transition-transform duration-300 group-hover:-translate-y-1">
                <Upload className="h-9 w-9" />
              </div>
              <div className="relative text-center">
                <p className="text-xl font-bold text-white">Drop your video or audio here</p>
                <p className="mt-1.5 text-sm text-white/45">or click to browse · MP4, MOV, MKV, WebM, MP3, WAV, M4A…</p>
              </div>
              <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)] transition-shadow group-hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.65)]">
                <Upload className="h-4 w-4" /> Choose a file
              </span>
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
            </div>
          </div>
        )}

        {/* ── How it works ── */}
        {stage === "idle" && (
          <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
            {[
              { n: "1", t: "Upload", d: "Pick a video or audio file. It stays on your device." },
              { n: "2", t: "Transcribe", d: "Whisper AI writes timed captions in your browser." },
              { n: "3", t: "Export", d: "Fix any word inline, then download SRT, VTT or TXT." },
            ].map(x => (
              <div key={x.n} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">{x.n}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{x.t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/45">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Workspace ── */}
        {stage !== "idle" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">

            {/* Left: video + controls */}
            <div className="space-y-4">

              {/* File bar */}
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                  <FileVideo className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{file?.name}</p>
                  <p className="text-xs text-white/40">{fmtBytes(file?.size ?? 0)} · {fmtTime(duration)}</p>
                </div>
                {stage === "ready" && (
                  <button onClick={reset} className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Video preview */}
              {videoUrl && !isAudio && (
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/50">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="max-h-80 w-full"
                    onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
                  />
                  {/* Active caption, burned over the video like a real short */}
                  {activeCap && stage === "done" && (
                    <div className="pointer-events-none absolute inset-x-4 bottom-14 flex justify-center">
                      <p
                        className="whitespace-pre-line text-center text-lg font-black uppercase leading-tight text-white sm:text-xl"
                        style={{ WebkitTextStroke: "1px black", paintOrder: "stroke fill", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
                      >
                        {activeCap.text}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Audio file preview */}
              {videoUrl && isAudio && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15">
                      <Volume2 className="h-6 w-6 text-indigo-400" />
                    </div>
                    <p className="font-medium">{file?.name}</p>
                  </div>
                  <audio src={videoUrl} controls className="w-full"
                    onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)} />
                </div>
              )}

              {/* Options */}
              {(stage === "ready" || stage === "error") && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-5 p-5">
                  {/* Language */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">Language</p>
                    <div className="relative">
                      <select
                        value={opts.language ?? ""}
                        onChange={e => setOpt("language", e.target.value || null)}
                        className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white focus:border-indigo-400/60 focus:outline-none"
                      >
                        {WHISPER_LANGUAGES.map(l => (
                          <option key={l.label} value={l.code ?? ""} className="bg-[#0d0d1a]">
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-white/40" />
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">AI model</p>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
                      {WHISPER_MODELS.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setOpt("model", m.id)}
                          className={`rounded-lg px-3 py-2 text-left transition-colors ${opts.model === m.id ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                        >
                          <span className="block text-sm font-semibold">{m.label}</span>
                          <span className={`block text-[10px] ${opts.model === m.id ? "text-black/55" : "text-white/35"}`}>{m.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced toggle */}
                  <button onClick={() => setShowOpts(a => !a)}
                    className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors">
                    <Settings2 className="h-3.5 w-3.5" />
                    Advanced options
                    <ChevronDown className={`h-3 w-3 transition-transform ${showOpts ? "rotate-180" : ""}`} />
                  </button>

                  {showOpts && (
                    <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1 text-xs text-white/40">Max line length (chars)</p>
                          <input type="range" min={20} max={80} step={2} value={opts.maxLineLength}
                            onChange={e => setOpt("maxLineLength", +e.target.value)}
                            className="w-full accent-indigo-500" />
                          <p className="text-xs text-indigo-400">{opts.maxLineLength} chars</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-white/40">Max segment duration (s)</p>
                          <input type="range" min={1} max={10} step={0.5} value={opts.maxLineDuration}
                            onChange={e => setOpt("maxLineDuration", +e.target.value)}
                            className="w-full accent-indigo-500" />
                          <p className="text-xs text-indigo-400">{opts.maxLineDuration}s</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {stage === "error" && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  <button onClick={generate}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98]">
                    <Zap className="h-4 w-4" />
                    Generate Captions
                  </button>
                </div>
              )}

              {/* Progress */}
              {(stage === "extracting" || stage === "transcribing") && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    <p className="font-semibold text-white">{progressMsg}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 shadow-[0_0_12px_rgba(167,139,250,0.8)] transition-all duration-500"
                      style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/30">
                    <span>{progress}% complete</span>
                    {stage === "transcribing" && (
                      <button onClick={stopTranscription}
                        className="rounded-lg border border-white/[0.08] px-3 py-1 text-white/50 hover:text-white transition-colors">
                        Stop
                      </button>
                    )}
                  </div>
                  {stage === "transcribing" && (
                    <p className="text-xs text-white/30">Runs on your device — long videos can take a few minutes. Keep this tab open.</p>
                  )}
                </div>
              )}

              {/* Done stats */}
              {stage === "done" && captions.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Segments", value: captions.length },
                    { label: "Words", value: wordCount },
                    { label: "Duration", value: fmtTime(duration) },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                      <p className="text-2xl font-extrabold tracking-tight text-white">{s.value}</p>
                      <p className="text-xs text-white/40">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Re-generate button */}
              {stage === "done" && (
                <button onClick={() => setStage("ready")}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/25 hover:text-white">
                  <Mic className="h-4 w-4" /> Re-generate captions
                </button>
              )}
            </div>

            {/* Right: captions panel */}
            <div className="flex flex-col gap-3">

              {/* Export bar */}
              {captions.length > 0 && (
                <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-3 pl-5">
                  <p className="flex-1 text-xs text-white/40 font-medium">Export as</p>
                  {(["srt", "vtt", "txt"] as const).map(f => (
                    <button key={f} onClick={() => exportFile(f)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase text-white/75 transition-all hover:bg-white hover:text-black">
                      <Download className="h-3 w-3" />{f}
                    </button>
                  ))}
                  <button onClick={copyAll}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-all hover:text-white">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {/* Caption list */}
              <div
                ref={listRef}
                className="scrollbar-slim flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur"
                style={{ maxHeight: "calc(100vh - 280px)", minHeight: 300 }}
              >
                {captions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
                      <Captions className="h-7 w-7 text-indigo-400/50" />
                    </div>
                    <p className="text-sm text-white/30">
                      {stage === "transcribing" ? "Captions will appear here…" : "No captions yet — click Generate"}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-1.5">
                    {captions.map((cap) => {
                      const isActive = currentTime >= cap.start && currentTime <= cap.end;
                      const isEditing = editId === cap.id;
                      return (
                        <div
                          id={`cap-${cap.id}`}
                          key={cap.id}
                          className={`group rounded-2xl border px-3.5 py-3 transition-all cursor-pointer
                            ${isActive
                              ? "border-indigo-400/50 bg-indigo-500/15 shadow-[0_0_24px_-10px_rgba(129,140,248,0.9)]"
                              : "border-white/[0.05] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"}`}
                          onClick={() => !isEditing && seekTo(cap.start)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 rounded-md bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] text-indigo-200/80">
                              {fmtTime(cap.start)}
                            </span>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <textarea
                                  autoFocus
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  rows={2}
                                  className="w-full resize-none rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                                />
                              ) : (
                                <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">{cap.text}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              {isEditing ? (
                                <button onClick={() => saveEdit(cap.id)} className="rounded p-1 text-emerald-400 hover:bg-white/[0.06]">
                                  <Save className="h-3 w-3" />
                                </button>
                              ) : (
                                <button onClick={() => startEdit(cap)} className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/70">
                                  <Edit3 className="h-3 w-3" />
                                </button>
                              )}
                              <button onClick={() => deleteCaption(cap.id)} className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-red-400">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Info cards ── */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Mic className="h-5 w-5 text-indigo-400" />,
              title: "Whisper AI, in your browser",
              body: "OpenAI's open Whisper model runs on your device — accurate, ~99 languages, and your file is never uploaded.",
            },
            {
              icon: <Edit3 className="h-5 w-5 text-purple-400" />,
              title: "Edit inline",
              body: "Click any caption segment to seek the video. Edit text directly. Delete unwanted segments.",
            },
            {
              icon: <FileText className="h-5 w-5 text-violet-400" />,
              title: "SRT · VTT · TXT",
              body: "Export industry-standard subtitle files ready to upload to YouTube, TikTok, or any platform.",
            },
          ].map(c => (
            <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                {c.icon}
              </div>
              <p className="font-semibold text-white">{c.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.body}</p>
            </div>
          ))}
        </div>

        {/* Model notice */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] px-5 py-4">
          <Zap className="h-4 w-4 shrink-0 text-indigo-300 mt-0.5" />
          <p className="text-xs text-indigo-200/70 leading-relaxed">
            <span className="font-semibold text-indigo-200">First run downloads the AI model once</span>{" "}
            (about 40–80 MB) and your browser caches it. No microphone access needed — the audio is read straight from your file.
          </p>
        </div>
      </div>
    </div>
  );
}
