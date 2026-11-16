"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, FileVideo, Zap, ShieldCheck, Globe,
  Loader2, AlertCircle, X, Info, Copy, Check,
  Film, Music, HardDrive, Clock, Gauge, Layers, Tag,
  Monitor, Volume2, Hash, Database, ChevronDown, ChevronRight,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "analyzing" | "done" | "error";

interface VideoStream {
  index: number;
  codec: string;
  codecLong: string;
  profile?: string;
  width?: number;
  height?: number;
  displayAspect?: string;
  sampleAspect?: string;
  fps?: string;
  tbr?: string;
  bitrate?: string;
  pixFmt?: string;
  colorSpace?: string;
  colorRange?: string;
  level?: string;
  language?: string;
  title?: string;
  default?: boolean;
  raw: string;
}

interface AudioStream {
  index: number;
  codec: string;
  codecLong: string;
  profile?: string;
  sampleRate?: string;
  channels?: string;
  channelLayout?: string;
  bitrate?: string;
  language?: string;
  title?: string;
  default?: boolean;
  raw: string;
}

interface SubtitleStream {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  raw: string;
}

interface MetadataTags {
  [key: string]: string;
}

interface VideoMetadata {
  // File info
  filename: string;
  fileSize: number;
  fileExt: string;
  // Container
  format: string;
  formatLong: string;
  duration: string;
  durationSec: number;
  startTime?: string;
  overallBitrate?: string;
  // Streams
  videoStreams: VideoStream[];
  audioStreams: AudioStream[];
  subtitleStreams: SubtitleStream[];
  // Tags
  tags: MetadataTags;
  // Raw log
  rawLog: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parseDuration(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(3);
  if (h > 0) return `${h}h ${m}m ${parseFloat(s).toFixed(0)}s`;
  if (m > 0) return `${m}m ${parseFloat(s).toFixed(0)}s`;
  return `${s}s`;
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function aspectRatio(w: number, h: number): string {
  const d = gcd(w, h); return `${w / d}:${h / d}`;
}

// ─── FFmpeg log parser ────────────────────────────────────────────────────────

function parseFFmpegLog(log: string, filename: string, fileSize: number): VideoMetadata {
  const lines = log.split("\n");

  // Format line: "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.xxx':"
  const formatMatch = log.match(/Input #0,\s*([^\n,]+(?:,[^\n,]+)*?),\s*from/);
  const formatRaw = formatMatch?.[1]?.trim() ?? "";
  const formatParts = formatRaw.split(",").map(s => s.trim()).filter(Boolean);
  const format = formatParts[0] ?? "";

  // Format long name from Metadata section
  const formatLongMatch = log.match(/from '[^']+':[\s\n]*(?:Metadata:[\s\S]*?\n)?[\s\n]*Duration:/);
  const formatLong = formatParts.join(", ");

  // Duration line: "Duration: HH:MM:SS.mmm, start: X.X, bitrate: XXXX kb/s"
  const durMatch = log.match(/Duration:\s*([\d:.]+)/);
  const durationStr = durMatch?.[1] ?? "00:00:00";
  const durationSec = parseDuration(durationStr);

  const startMatch = log.match(/start:\s*([\d.]+)/);
  const bitrateMatch = log.match(/bitrate:\s*([\d.]+ [kKMG]b\/s)/);

  // Tags / Metadata block
  const tags: MetadataTags = {};
  const metaBlock = log.match(/Metadata:\s*\n([\s\S]*?)(?=\s*Duration:|$)/);
  if (metaBlock?.[1]) {
    const tagLines = metaBlock[1].split("\n");
    for (const line of tagLines) {
      const m = line.match(/^\s{4}(\w[\w\s]+?)\s*:\s*(.+)$/);
      if (m) tags[m[1].trim()] = m[2].trim();
    }
  }

  // Stream lines
  const videoStreams: VideoStream[] = [];
  const audioStreams: AudioStream[] = [];
  const subtitleStreams: SubtitleStream[] = [];

  const streamLines = lines.filter(l => l.match(/Stream #\d+:\d+/));

  for (const line of streamLines) {
    const idxMatch = line.match(/Stream #(\d+):(\d+)(?:\((\w+)\))?/);
    const streamIdx = parseInt(idxMatch?.[2] ?? "0");
    const lang = idxMatch?.[3];
    const isDefault = line.includes("(default)");

    if (line.includes(": Video:")) {
      // e.g. Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080 [SAR 1:1 DAR 16:9], 4306 kb/s, 29.97 fps, ...
      const codecMatch = line.match(/Video:\s+(\w+)(?:\s+\(([^)]+)\))?/);
      const dimsMatch  = line.match(/(\d{2,5})x(\d{2,5})/);
      const sarMatch   = line.match(/SAR\s+([\d:]+)/);
      const darMatch   = line.match(/DAR\s+([\d:]+)/);
      const fpsMatch   = line.match(/([\d.]+)\s+fps/);
      const tbrMatch   = line.match(/([\d.]+)\s+tbr/);
      const bitrMatch  = line.match(/([\d.]+\s+[kKMG]b\/s)/);
      const pixMatch   = line.match(/Video:[^,]+,\s+([a-z0-9]+),\s+\d/);
      const colorMatch = line.match(/yuv\S+|rgb\S+/);
      const levelMatch = line.match(/Level\s+(\d+)/i);

      const w = parseInt(dimsMatch?.[1] ?? "0");
      const h = parseInt(dimsMatch?.[2] ?? "0");

      videoStreams.push({
        index: streamIdx,
        codec: codecMatch?.[1] ?? "",
        codecLong: codecMatch?.[1] ?? "",
        profile: codecMatch?.[2],
        width: w || undefined,
        height: h || undefined,
        displayAspect: darMatch?.[1] ?? (w && h ? aspectRatio(w, h) : undefined),
        sampleAspect: sarMatch?.[1],
        fps: fpsMatch?.[1],
        tbr: tbrMatch?.[1],
        bitrate: bitrMatch?.[1],
        pixFmt: colorMatch?.[0] ?? pixMatch?.[1],
        language: lang,
        default: isDefault,
        raw: line.trim(),
      });
    } else if (line.includes(": Audio:")) {
      // e.g. Audio: aac (LC) (mp4a / ...), 48000 Hz, stereo, fltp, 256 kb/s
      const codecMatch = line.match(/Audio:\s+(\w+)(?:\s+\(([^)]+)\))?/);
      const srMatch    = line.match(/([\d]+)\s+Hz/);
      const chanMatch  = line.match(/Hz,\s+(stereo|mono|[\d.]+[ck])/);
      const layoutMatch = line.match(/Hz,\s+\w+,\s+([\w.]+),/);
      const bitrMatch  = line.match(/([\d.]+\s+[kKMG]b\/s)/);

      audioStreams.push({
        index: streamIdx,
        codec: codecMatch?.[1] ?? "",
        codecLong: codecMatch?.[1] ?? "",
        profile: codecMatch?.[2],
        sampleRate: srMatch?.[1],
        channels: chanMatch?.[1],
        channelLayout: layoutMatch?.[1],
        bitrate: bitrMatch?.[1],
        language: lang,
        default: isDefault,
        raw: line.trim(),
      });
    } else if (line.includes(": Subtitle:")) {
      const codecMatch = line.match(/Subtitle:\s+(\w+)/);
      subtitleStreams.push({
        index: streamIdx,
        codec: codecMatch?.[1] ?? "",
        language: lang,
        raw: line.trim(),
      });
    }
  }

  return {
    filename,
    fileSize,
    fileExt: filename.split(".").pop()?.toUpperCase() ?? "",
    format,
    formatLong,
    duration: durationStr,
    durationSec,
    startTime: startMatch?.[1],
    overallBitrate: bitrateMatch?.[1],
    videoStreams,
    audioStreams,
    subtitleStreams,
    tags,
    rawLog: log,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

function MetaRow({ label, value, mono = false, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-white/45">{label}</span>
      <span className={`break-all text-right text-xs ${mono ? "font-mono" : ""} ${accent ? "font-semibold text-sky-100" : "text-white/75"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur">
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">{icon}</span>
        <p className="flex-1 text-sm font-semibold text-white">{title}</p>
        {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
      </button>
      {open && <div className="px-5 pb-4 space-y-0">{children}</div>}
    </div>
  );
}

function Badge({ label, color = "slate" }: { label: string; color?: "emerald" | "blue" | "purple" | "amber" | "slate" }) {
  const cls = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    blue:    "border-blue-500/30 bg-blue-500/10 text-blue-300",
    purple:  "border-purple-500/30 bg-purple-500/10 text-purple-300",
    amber:   "border-amber-500/30 bg-amber-500/10 text-amber-300",
    slate:   "border-white/10 bg-white/[0.04] text-white/50",
  }[color];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

export function VideoMetadataViewer() {
  const [stage, setStage]   = useState<Stage>("idle");
  const [file, setFile]     = useState<File | null>(null);
  const [meta, setMeta]     = useState<VideoMetadata | null>(null);
  const [error, setError]   = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [progress, setProgress] = useState(0);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffLoaded  = useRef(false);
  const fileRef   = useRef<HTMLInputElement>(null);

  const ACCEPT = "video/*,audio/*,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.m4v,.3gp,.ts,.mts,.mp3,.m4a,.wav,.flac,.ogg";

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
      constructor(url: string | URL, wopts?: WorkerOptions) {
        super(typeof url === "string" && url.includes("ffmpeg-core") ? workerURL : url, { ...wopts, type: "classic" });
      }
    };
    await ff.load({ coreURL, wasmURL });
    (window as any).Worker = OrigWorker;
    ffmpegRef.current = ff;
    ffLoaded.current  = true;
    return ff;
  }, []);

  // ── Analyze ──
  const analyze = useCallback(async (f: File) => {
    setFile(f); setStage("analyzing"); setProgress(20); setMeta(null); setError("");

    try {
      const ff = await loadFFmpeg();
      setProgress(50);

      const ext    = f.name.split(".").pop() ?? "mp4";
      const inName = `input.${ext}`;
      await ff.writeFile(inName, await fetchFile(f));

      setProgress(70);

      // Collect all log output
      const logLines: string[] = [];
      ff.on("log", ({ message }) => logLines.push(message));

      // Run with invalid output to force FFmpeg to print info and exit
      await ff.exec(["-i", inName, "-f", "null", "/dev/null"]);

      try { await ff.deleteFile(inName); } catch { /* ok */ }

      const rawLog = logLines.join("\n");
      const parsed = parseFFmpegLog(rawLog, f.name, f.size);
      setMeta(parsed);
      setProgress(100);
      setStage("done");
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed.");
      setStage("error");
    }
  }, [loadFFmpeg]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) analyze(f);
  }, [analyze]);

  const reset = () => {
    setStage("idle"); setFile(null); setMeta(null); setError(""); setProgress(0);
  };

  const copyAsJson = async () => {
    if (!meta) return;
    const out = {
      file: { name: meta.filename, size: meta.fileSize, extension: meta.fileExt },
      container: { format: meta.format, formatLong: meta.formatLong, duration: meta.duration, durationSeconds: meta.durationSec, bitrate: meta.overallBitrate },
      videoStreams: meta.videoStreams,
      audioStreams: meta.audioStreams,
      subtitleStreams: meta.subtitleStreams,
      tags: meta.tags,
    };
    await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const videoStream = meta?.videoStreams[0];
  const audioStream = meta?.audioStreams[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(14,165,233,0.2), transparent 70%), radial-gradient(30% 40% at 85% 10%, rgba(99,102,241,0.12), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-4xl">

        {/* ── Header ── */}
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mx-auto mb-10 mt-8 max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/30 to-indigo-500/15 shadow-[0_0_40px_-8px_rgba(14,165,233,0.7)]">
            <Database className="h-8 w-8 text-sky-200" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Video{" "}
            <span className="bg-gradient-to-r from-sky-200 via-sky-300 to-indigo-300 bg-clip-text text-transparent">Metadata</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
            See what&apos;s inside any video or audio file — codec, resolution, bitrate, FPS, streams and tags.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "100% Private" },
              { icon: <Globe       className="h-3.5 w-3.5" />, label: "No Upload" },
              { icon: <Zap         className="h-3.5 w-3.5" />, label: "Instant Analysis" },
              { icon: <Layers      className="h-3.5 w-3.5" />, label: "All Streams · JSON" },
            ].map(p => (
              <span key={p.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur">
                <span className="text-sky-300">{p.icon}</span>{p.label}
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
            className={`group relative cursor-pointer overflow-hidden rounded-[2rem] border p-2 transition-all duration-300
              ${dragging ? "border-sky-400/70 shadow-[0_0_60px_-10px_rgba(14,165,233,0.7)]" : "border-white/10 hover:border-sky-400/40 hover:shadow-[0_0_60px_-16px_rgba(14,165,233,0.6)]"}`}
          >
            <div className={`relative flex flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-dashed px-6 py-20 transition-colors
              ${dragging ? "border-sky-400/60 bg-sky-500/10" : "border-white/10 bg-white/[0.02] group-hover:bg-white/[0.035]"}`}>
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/15 blur-3xl" aria-hidden />
              {/* Spec-sheet motif */}
              <div className="relative w-56 space-y-2 rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-500/15 to-indigo-500/10 p-4 text-left shadow-[0_0_30px_-8px_rgba(14,165,233,0.8)] transition-transform duration-300 group-hover:-translate-y-1" aria-hidden>
                {[["Codec", "h264"], ["Resolution", "1920×1080"], ["Frame rate", "30 fps"]].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px]">
                    <span className="text-white/45">{k}</span>
                    <span className="font-mono font-semibold text-sky-100">{v}</span>
                  </div>
                ))}
              </div>
              <div className="relative text-center">
                <p className="text-xl font-bold text-white">Drop any video or audio file</p>
                <p className="mt-1.5 text-sm text-white/45">or click to browse · it never leaves your device</p>
              </div>
              <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)] transition-shadow group-hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.65)]">
                <Upload className="h-4 w-4" /> Choose a file
              </span>
              <div className="relative flex flex-wrap justify-center gap-1.5">
                {["MP4","MOV","AVI","MKV","WebM","FLV","TS","MP3","WAV","FLAC","OGG","AAC"].map(f => (
                  <span key={f} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-white/45">{f}</span>
                ))}
              </div>
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); }} />
            </div>
          </div>
        )}

        {/* ── Analyzing ── */}
        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur py-20">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-sky-400/30 bg-sky-500/15 shadow-[0_0_40px_-8px_rgba(14,165,233,0.8)]">
                <Database className="h-10 w-10 text-sky-200" />
              </div>
              <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-sky-300" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">Analyzing metadata…</p>
              <p className="mt-1 text-sm text-white/50">{file?.name}</p>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 shadow-[0_0_12px_rgba(56,189,248,0.8)] transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {stage === "error" && (
          <div className="flex items-start gap-3 rounded-3xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-5">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Analysis failed</p>
              <p className="mt-1 text-sm text-red-300/70">{error}</p>
            </div>
            <button onClick={reset} className="text-white/30 hover:text-white/70 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Results ── */}
        {stage === "done" && meta && (
          <div className="space-y-4">

            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                <FileVideo className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{meta.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge label={meta.fileExt} color="slate" />
                  {meta.videoStreams.length > 0 && <Badge label="Video" color="blue" />}
                  {meta.audioStreams.length > 0 && <Badge label="Audio" color="emerald" />}
                  {meta.subtitleStreams.length > 0 && <Badge label={`${meta.subtitleStreams.length} Sub`} color="purple" />}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={copyAsJson}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_20px_-6px_rgba(255,255,255,0.5)] transition-shadow hover:shadow-[0_0_28px_-4px_rgba(255,255,255,0.6)]">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
                <button onClick={reset}
                  className="rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:border-white/25 hover:text-white px-4 py-2 text-xs text-white/70">
                  Analyze another
                </button>
              </div>
            </div>

            {/* Quick-glance stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Duration",   value: fmtDuration(meta.durationSec), icon: <Clock className="h-4 w-4" />,  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
                { label: "File size",  value: fmtBytes(meta.fileSize),        icon: <HardDrive className="h-4 w-4" />, color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
                { label: "Resolution", value: videoStream ? `${videoStream.width}×${videoStream.height}` : "—", icon: <Monitor className="h-4 w-4" />, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                { label: "Bitrate",    value: meta.overallBitrate ?? "—",     icon: <Gauge className="h-4 w-4" />,  color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
              ].map(s => (
                <div key={s.label} className={`rounded-3xl border ${s.border} ${s.bg} px-5 py-5 transition-transform hover:-translate-y-0.5`}>
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-black/20 ${s.color}`}>{s.icon}</div>
                  <p className="text-xl font-extrabold tracking-tight text-white">{s.value}</p>
                  <p className="mt-0.5 text-xs text-white/50">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Container / Format */}
            <Section title="Container & Format" icon={<HardDrive className="h-4 w-4" />}>
              <MetaRow label="Format"         value={meta.format}         mono accent />
              <MetaRow label="Format (long)"  value={meta.formatLong}     />
              <MetaRow label="Duration"       value={`${meta.duration} (${fmtDuration(meta.durationSec)})`} accent />
              {meta.startTime && <MetaRow label="Start time"  value={`${meta.startTime}s`} mono />}
              {meta.overallBitrate && <MetaRow label="Overall bitrate" value={meta.overallBitrate} mono accent />}
              <MetaRow label="File size"      value={fmtBytes(meta.fileSize)} accent />
              <MetaRow label="File extension" value={meta.fileExt}        mono />
              <MetaRow label="Streams"        value={`${meta.videoStreams.length} video · ${meta.audioStreams.length} audio · ${meta.subtitleStreams.length} subtitle`} />
            </Section>

            {/* Video streams */}
            {meta.videoStreams.map((vs, i) => (
              <Section key={i} title={`Video Stream #${vs.index}${vs.language ? ` (${vs.language})` : ""}`} icon={<Film className="h-4 w-4" />}>
                <MetaRow label="Codec"           value={vs.codec}                     mono accent />
                {vs.profile && <MetaRow label="Profile"        value={vs.profile}                   mono />}
                {vs.width && vs.height && <>
                  <MetaRow label="Resolution"      value={`${vs.width} × ${vs.height}`}   accent />
                  <MetaRow label="Aspect ratio"    value={vs.displayAspect ?? aspectRatio(vs.width, vs.height)} mono />
                  {vs.sampleAspect && <MetaRow label="Sample aspect" value={vs.sampleAspect}              mono />}
                </>}
                {vs.fps    && <MetaRow label="Frame rate"     value={`${vs.fps} fps`}              mono accent />}
                {vs.tbr    && <MetaRow label="Base framerate" value={`${vs.tbr} tbr`}              mono />}
                {vs.bitrate && <MetaRow label="Bitrate"        value={vs.bitrate}                   mono accent />}
                {vs.pixFmt && <MetaRow label="Pixel format"   value={vs.pixFmt}                    mono />}
                <MetaRow label="Default stream" value={vs.default ? "Yes" : "No"} />
                <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/30 px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">Raw stream info</p>
                  <p className="break-all font-mono text-[10px] leading-relaxed text-white/50">{vs.raw}</p>
                </div>
              </Section>
            ))}

            {/* Audio streams */}
            {meta.audioStreams.map((as, i) => (
              <Section key={i} title={`Audio Stream #${as.index}${as.language ? ` (${as.language})` : ""}`} icon={<Music className="h-4 w-4" />}>
                <MetaRow label="Codec"         value={as.codec}          mono accent />
                {as.profile && <MetaRow label="Profile"      value={as.profile}        mono />}
                {as.sampleRate && <MetaRow label="Sample rate"  value={`${as.sampleRate} Hz`} mono accent />}
                {as.channels && <MetaRow label="Channels"     value={as.channels}       mono accent />}
                {as.channelLayout && <MetaRow label="Channel layout" value={as.channelLayout} mono />}
                {as.bitrate && <MetaRow label="Bitrate"      value={as.bitrate}        mono accent />}
                <MetaRow label="Default"       value={as.default ? "Yes" : "No"} />
                <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/30 px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">Raw stream info</p>
                  <p className="break-all font-mono text-[10px] leading-relaxed text-white/50">{as.raw}</p>
                </div>
              </Section>
            ))}

            {/* Subtitle streams */}
            {meta.subtitleStreams.length > 0 && (
              <Section title={`Subtitle Streams (${meta.subtitleStreams.length})`} icon={<Layers className="h-4 w-4" />}>
                {meta.subtitleStreams.map((ss, i) => (
                  <div key={i} className="py-2 border-b border-white/[0.04] last:border-0">
                    <MetaRow label={`Stream #${ss.index}`} value={`${ss.codec}${ss.language ? ` · ${ss.language}` : ""}${ss.title ? ` · ${ss.title}` : ""}`} mono />
                  </div>
                ))}
              </Section>
            )}

            {/* Tags */}
            {Object.keys(meta.tags).length > 0 && (
              <Section title="Metadata Tags" icon={<Tag className="h-4 w-4" />} defaultOpen={false}>
                {Object.entries(meta.tags).map(([k, v]) => (
                  <MetaRow key={k} label={k} value={v} />
                ))}
              </Section>
            )}

            {/* Raw log */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur">
              <button onClick={() => setShowRaw(r => !r)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15"><Hash className="h-4 w-4 text-sky-300" /></span>
                <p className="flex-1 text-sm font-semibold text-white">Raw FFmpeg Output</p>
                {showRaw ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
              </button>
              {showRaw && (
                <pre className="scrollbar-slim mx-5 mb-5 max-h-80 overflow-y-auto whitespace-pre-wrap break-all rounded-2xl border border-white/[0.06] bg-black/30 p-4 font-mono text-[10px] leading-relaxed text-white/50">
                  {meta.rawLog}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* ── Feature cards ── */}
        {stage !== "analyzing" && (
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: <Film      className="h-5 w-5 text-sky-300"  />, title: "Full stream analysis",  body: "All video, audio and subtitle streams with codec, bitrate, FPS, resolution, pixel format and more." },
              { icon: <Tag       className="h-5 w-5 text-indigo-300"   />, title: "Metadata & tags",       body: "Read embedded title, artist, date, encoder, copyright and all custom metadata tags." },
              { icon: <Database  className="h-5 w-5 text-cyan-300"   />, title: "Export as JSON",        body: "Copy all parsed metadata as clean JSON — perfect for logging, scripting, or debugging." },
            ].map(c => (
              <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">{c.icon}</div>
                <p className="font-semibold text-white">{c.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] px-5 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <p className="text-xs leading-relaxed text-sky-100/70">
            <span className="font-semibold text-sky-200">Zero data collection.</span>{" "}
            Your file is read entirely in-browser using FFmpeg WebAssembly — no bytes are ever sent to a server. Supports MP4, MOV, AVI, MKV, WebM, FLV, TS, 3GP, MP3, WAV, FLAC, OGG, AAC and more.
          </p>
        </div>
      </div>
    </div>
  );
}
