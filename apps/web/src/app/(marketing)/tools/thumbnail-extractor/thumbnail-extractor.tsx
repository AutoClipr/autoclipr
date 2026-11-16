"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, Download, FileVideo, Zap, ShieldCheck, Globe,
  Loader2, AlertCircle, X, Info, Camera, Grid3x3, Clock,
  Trash2, Check, ChevronDown, Settings2, Image as ImageIcon,
  Play, Pause, SkipBack, SkipForward, ScanLine, Layers,
  RefreshCw, ZoomIn,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "ready" | "scanning" | "error";
type ExportFormat = "png" | "jpg" | "webp";

interface CapturedFrame {
  id: string;
  timestamp: number;
  dataUrl: string;
  width: number;
  height: number;
}

interface ExtractOpts {
  format: ExportFormat;
  quality: number;           // 0-1 for jpg/webp
  maxDim: number;            // 0 = original
  prefix: string;
}

const DEFAULT_OPTS: ExtractOpts = {
  format: "png",
  quality: 0.92,
  maxDim: 0,
  prefix: "frame",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTimestamp(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(3);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${sec.padStart(6, "0")}`;
  return `${String(m).padStart(2, "0")}:${sec.padStart(6, "0")}`;
}

function fmtTimestampShort(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms  = Math.round((s % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${ms}`;
}

function parseTimestamp(s: string): number | null {
  // Accept HH:MM:SS.mmm, MM:SS.mmm, MM:SS, or raw seconds
  const parts = s.trim().split(":");
  if (parts.length === 1) {
    const n = parseFloat(parts[0]);
    return isNaN(n) ? null : n;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0]);
    const sec = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(sec)) return null;
    return m * 60 + sec;
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const sec = parseFloat(parts[2]);
    if (isNaN(h) || isNaN(m) || isNaN(sec)) return null;
    return h * 3600 + m * 60 + sec;
  }
  return null;
}

// Draw video frame to canvas and return dataUrl
function captureFrame(
  video: HTMLVideoElement,
  opts: ExtractOpts,
): { dataUrl: string; width: number; height: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  let w = vw, h = vh;
  if (opts.maxDim > 0 && (vw > opts.maxDim || vh > opts.maxDim)) {
    const scale = opts.maxDim / Math.max(vw, vh);
    w = Math.round(vw * scale);
    h = Math.round(vh * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);

  const mime = opts.format === "jpg" ? "image/jpeg"
    : opts.format === "webp" ? "image/webp"
    : "image/png";
  const quality = opts.format === "png" ? undefined : opts.quality;
  return { dataUrl: canvas.toDataURL(mime, quality), width: w, height: h };
}

// Estimate dataUrl size
function dataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round(base64.length * 0.75);
}

// ─── NATIVE-INCOMPATIBLE FORMATS ─────────────────────────────────────────────
// For these, we need FFmpeg to remux to a playable format first
const NON_NATIVE = new Set(["avi", "flv", "wmv", "ts", "mts", "3gp", "m4v", "mkv"]);

// ─── Component ────────────────────────────────────────────────────────────────

export function ThumbnailExtractor() {
  const [stage, setStage]               = useState<Stage>("idle");
  const [file, setFile]                 = useState<File | null>(null);
  const [videoUrl, setVideoUrl]         = useState<string | null>(null);
  const [duration, setDuration]         = useState(0);
  const [videoDims, setVideoDims]       = useState({ w: 0, h: 0 });
  const [currentTime, setCurrentTime]   = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [frames, setFrames]             = useState<CapturedFrame[]>([]);
  const [opts, setOpts]                 = useState<ExtractOpts>(DEFAULT_OPTS);
  const [dragging, setDragging]         = useState(false);
  const [error, setError]               = useState("");
  const [showOpts, setShowOpts]         = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [timestampInput, setTimestampInput] = useState("");
  const [scanCount, setScanCount]       = useState(12);
  const [scanning, setScanning]         = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [convertMsg, setConvertMsg]     = useState("");
  const [lightboxFrame, setLightboxFrame] = useState<CapturedFrame | null>(null);
  const [hoverTime, setHoverTime]       = useState<number | null>(null);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const ffmpegRef   = useRef<FFmpeg | null>(null);
  const ffLoaded    = useRef(false);
  const seekQueue   = useRef<Promise<void>>(Promise.resolve());

  const ACCEPT = "video/*,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.m4v,.3gp,.ts,.mts";
  const setOpt = <K extends keyof ExtractOpts>(k: K, v: ExtractOpts[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  // ── FFmpeg loader (for non-native formats) ──
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

  // ── File pick (shared logic) ──
  const handleFile = useCallback((f: File) => {
    setFile(f);
    setFrames([]); setSelectedIds(new Set()); setError("");
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (NON_NATIVE.has(ext)) {
      setConvertMsg(`Converting ${ext.toUpperCase()} for browser playback…`);
      loadFFmpeg().then(async ff => {
        try {
          const inName = `input.${ext}`; const outName = "playable.mp4";
          await ff.writeFile(inName, await fetchFile(f));
          const ret = await ff.exec(["-y", "-i", inName, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", outName]);
          if (ret !== 0) throw new Error("Could not convert this file for browser playback.");
          const data = await ff.readFile(outName) as Uint8Array;
          const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
          setVideoUrl(URL.createObjectURL(blob));
          try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch { /* ok */ }
          setConvertMsg(""); setStage("ready");
        } catch (e: any) {
          setError(e?.message ?? "Could not open this video format.");
          setStage("error"); setConvertMsg("");
        }
      });
    } else {
      setVideoUrl(URL.createObjectURL(f));
      setStage("ready");
    }
  }, [loadFFmpeg]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setDuration(v.duration);
    setVideoDims({ w: v.videoWidth, h: v.videoHeight });
  };

  // ── Playback controls ──
  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onEnd  = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnd); };
  }, [videoUrl]);

  const seekTo = (t: number): Promise<void> => {
    const v = videoRef.current;
    if (!v) return Promise.resolve();
    return new Promise(resolve => {
      const onSeeked = () => { v.removeEventListener("seeked", onSeeked); resolve(); };
      v.addEventListener("seeked", onSeeked);
      v.currentTime = Math.max(0, Math.min(t, duration));
    });
  };

  const stepFrame = (delta: number) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + delta, duration));
  };

  // ── Progress bar ──
  const onProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    const t    = pct * duration;
    const v = videoRef.current; if (v) v.currentTime = t;
  };

  const onProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    setHoverTime(pct * duration);
  };

  // ── Capture current frame ──
  const captureCurrentFrame = () => {
    const v = videoRef.current; if (!v) return;
    const { dataUrl, width, height } = captureFrame(v, opts);
    setFrames(fs => [{ id: uid(), timestamp: v.currentTime, dataUrl, width, height }, ...fs]);
  };

  // ── Jump to timestamp input ──
  const jumpToTimestamp = () => {
    const t = parseTimestamp(timestampInput);
    if (t === null || t < 0 || t > duration) return;
    const v = videoRef.current; if (v) v.currentTime = t;
    setTimestampInput("");
  };

  // ── Capture at typed timestamp ──
  const captureAtTimestamp = async () => {
    const t = parseTimestamp(timestampInput);
    if (t === null || t < 0 || t > duration) return;
    const v = videoRef.current; if (!v) return;
    v.pause(); setIsPlaying(false);
    await seekTo(t);
    captureCurrentFrame();
  };

  // ── Auto-scan: extract N evenly-spaced frames ──
  const autoScan = async () => {
    const v = videoRef.current;
    if (!v || duration === 0) return;
    setScanning(true); setScanProgress(0);
    v.pause(); setIsPlaying(false);

    const newFrames: CapturedFrame[] = [];
    const step = duration / (scanCount + 1);

    for (let i = 1; i <= scanCount; i++) {
      const t = step * i;
      await seekTo(t);
      // Short delay for frame decode
      await new Promise(r => setTimeout(r, 80));
      const { dataUrl, width, height } = captureFrame(v, opts);
      newFrames.push({ id: uid(), timestamp: t, dataUrl, width, height });
      setScanProgress(Math.round((i / scanCount) * 100));
    }

    setFrames(fs => [...newFrames, ...fs]);
    setScanning(false);
  };

  // ── Selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll    = () => setSelectedIds(new Set(frames.map(f => f.id)));
  const deselectAll  = () => setSelectedIds(new Set());
  const deleteSelected = () => {
    setFrames(fs => fs.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
  };
  const deleteFrame  = (id: string) => setFrames(fs => fs.filter(f => f.id !== id));

  // ── Download ──
  const downloadFrame = (frame: CapturedFrame, idx: number) => {
    const a = document.createElement("a");
    a.href = frame.dataUrl;
    a.download = `${opts.prefix}_${String(idx + 1).padStart(3, "0")}_${fmtTimestampShort(frame.timestamp).replace(/:/g, "-")}.${opts.format}`;
    a.click();
  };

  const downloadSelected = () => {
    const toDownload = frames.filter(f => selectedIds.size > 0 ? selectedIds.has(f.id) : true);
    toDownload.forEach((f, i) => {
      setTimeout(() => downloadFrame(f, i), i * 80);
    });
  };

  const downloadAll = () => {
    frames.forEach((f, i) => setTimeout(() => downloadFrame(f, i), i * 80));
  };

  const reset = () => {
    setStage("idle"); setFile(null); setVideoUrl(null);
    setFrames([]); setError(""); setDuration(0); setCurrentTime(0);
    setVideoDims({ w: 0, h: 0 });
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const activeFrames = selectedIds.size > 0 ? frames.filter(f => selectedIds.has(f.id)) : frames;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(236,72,153,0.2), transparent 70%), radial-gradient(30% 40% at 15% 10%, rgba(244,63,94,0.12), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl">

        {/* ── Header ── */}
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mx-auto mb-10 mt-8 max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-400/30 bg-gradient-to-br from-pink-500/30 to-rose-500/15 shadow-[0_0_40px_-8px_rgba(236,72,153,0.7)]">
            <ImageIcon className="h-8 w-8 text-pink-200" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Thumbnail{" "}
            <span className="bg-gradient-to-r from-pink-300 via-rose-300 to-orange-200 bg-clip-text text-transparent">Extractor</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
            Grab any frame from any video as PNG, JPG or WebP. Scrub, snap or batch-scan — then download.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "100% Private" },
              { icon: <Globe       className="h-3.5 w-3.5" />, label: "No Upload" },
              { icon: <Camera      className="h-3.5 w-3.5" />, label: "PNG · JPG · WebP" },
              { icon: <Grid3x3     className="h-3.5 w-3.5" />, label: "Batch Extract" },
            ].map(p => (
              <span key={p.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur">
                <span className="text-pink-300">{p.icon}</span>{p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Drop zone ── */}
        {stage === "idle" && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`group relative mx-auto max-w-4xl cursor-pointer overflow-hidden rounded-[2rem] border p-2 transition-all duration-300
                ${dragging ? "border-pink-400/70 shadow-[0_0_60px_-10px_rgba(236,72,153,0.7)]" : "border-white/10 hover:border-pink-400/40 hover:shadow-[0_0_60px_-16px_rgba(236,72,153,0.6)]"}`}
            >
              <div className={`relative flex flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-dashed px-6 py-20 transition-colors
                ${dragging ? "border-pink-400/60 bg-pink-500/10" : "border-white/10 bg-white/[0.02] group-hover:bg-white/[0.035]"}`}>
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/15 blur-3xl" aria-hidden />
                {convertMsg ? (
                  <>
                    <Loader2 className="relative h-10 w-10 animate-spin text-pink-300" />
                    <p className="relative text-sm text-white/60">{convertMsg}</p>
                  </>
                ) : (
                  <>
                    {/* Film-strip motif */}
                    <div className="relative flex items-center gap-1.5 transition-transform duration-300 group-hover:-translate-y-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`flex h-14 w-20 items-center justify-center rounded-xl border ${i === 1 ? "border-pink-400/60 bg-pink-500/20 shadow-[0_0_24px_-6px_rgba(236,72,153,0.8)]" : "border-white/10 bg-white/[0.04]"}`}>
                          {i === 1 ? <Camera className="h-6 w-6 text-pink-200" /> : <ImageIcon className="h-5 w-5 text-white/25" />}
                        </div>
                      ))}
                    </div>
                    <div className="relative text-center">
                      <p className="text-xl font-bold text-white">Drop your video here</p>
                      <p className="mt-1.5 text-sm text-white/45">or click to browse · it never leaves your device</p>
                    </div>
                    <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)] transition-shadow group-hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.65)]">
                      <Upload className="h-4 w-4" /> Choose a file
                    </span>
                    <div className="relative flex flex-wrap justify-center gap-1.5">
                      {["MP4","MOV","AVI","MKV","WebM","FLV","TS","3GP","WMV","M4V"].map(f => (
                        <span key={f} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-white/45">{f}</span>
                      ))}
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Upload", d: "Any video file. It stays on your device." },
                { n: "2", t: "Snap or scan", d: "Capture exact frames, or auto-scan up to 60." },
                { n: "3", t: "Download", d: "Save one, a selection, or all as PNG, JPG or WebP." },
              ].map(x => (
                <div key={x.n} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-200">{x.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{x.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">{x.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Converting overlay ── */}
        {convertMsg && stage !== "idle" && (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur py-20">
            <Loader2 className="h-10 w-10 animate-spin text-pink-400" />
            <p className="text-sm text-white/60">{convertMsg}</p>
          </div>
        )}

        {/* ── Error ── */}
        {stage === "error" && (
          <div className="mb-4 flex items-start gap-3 rounded-3xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-5">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Could not open video</p>
              <p className="mt-1 text-sm text-red-300/70">{error}</p>
            </div>
            <button onClick={reset} className="text-white/30 hover:text-white/70"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Workspace ── */}
        {stage === "ready" && !convertMsg && (
          <div className="space-y-4">

            {/* File bar */}
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-400">
                <FileVideo className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{file?.name}</p>
                <p className="text-xs text-white/40">
                  {fmtBytes(file?.size ?? 0)} · {videoDims.w > 0 ? `${videoDims.w}×${videoDims.h}` : "—"} · {fmtTimestamp(duration)}
                </p>
              </div>
              <button onClick={reset} className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">

              {/* Left — video player */}
              <div className="space-y-3">

                {/* Video */}
                <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/50">
                  {videoUrl && (
                    <video ref={videoRef} src={videoUrl} className="w-full" onLoadedMetadata={onMeta} />
                  )}
                  {/* Capture overlay button */}
                  <button
                    onClick={() => { videoRef.current?.pause(); setIsPlaying(false); captureCurrentFrame(); }}
                    className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black opacity-0 shadow-[0_0_24px_-4px_rgba(255,255,255,0.6)] transition-all active:scale-95 group-hover:opacity-100"
                  >
                    <Camera className="h-3.5 w-3.5" /> Snap
                  </button>
                </div>

                {/* Progress bar with hover preview */}
                <div className="space-y-2">
                  <div
                    ref={progressRef}
                    onClick={onProgressClick}
                    onMouseMove={onProgressHover}
                    onMouseLeave={() => setHoverTime(null)}
                    className="relative h-2 cursor-pointer overflow-visible rounded-full bg-white/[0.08] group"
                  >
                    {/* Fill */}
                    <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 shadow-[0_0_10px_rgba(244,114,182,0.8)] transition-none"
                      style={{ width: `${pct}%` }} />
                    {/* Thumb */}
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-pink-400 bg-white shadow-lg transition-none"
                      style={{ left: `${pct}%` }} />
                    {/* Frame markers */}
                    {frames.map(f => (
                      <div key={f.id}
                        className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-pink-400/70 rounded-full cursor-pointer"
                        style={{ left: `${(f.timestamp / duration) * 100}%` }}
                        onClick={e => { e.stopPropagation(); setLightboxFrame(f); }}
                        title={fmtTimestampShort(f.timestamp)}
                      />
                    ))}
                    {/* Hover tooltip */}
                    {hoverTime !== null && (
                      <div className="absolute -top-8 -translate-x-1/2 rounded-lg bg-black/90 px-2 py-1 text-[10px] font-mono text-white/80 pointer-events-none whitespace-nowrap"
                        style={{ left: `${(hoverTime / duration) * 100}%` }}>
                        {fmtTimestampShort(hoverTime)}
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => stepFrame(-1/30)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors" title="Previous frame">
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button onClick={togglePlay} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-[0_0_20px_-6px_rgba(255,255,255,0.6)] transition-transform hover:scale-105">
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => stepFrame(1/30)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors" title="Next frame">
                      <SkipForward className="h-4 w-4" />
                    </button>
                    <span className="ml-2 font-mono text-xs text-white/40">
                      {fmtTimestampShort(currentTime)} / {fmtTimestampShort(duration)}
                    </span>
                    <div className="flex-1" />
                    {/* Snap current frame */}
                    <button
                      onClick={() => { videoRef.current?.pause(); setIsPlaying(false); captureCurrentFrame(); }}
                      className="flex items-center gap-1.5 rounded-full border border-pink-400/40 bg-pink-500/15 px-4 py-2 text-xs font-semibold text-pink-100 shadow-[0_0_20px_-8px_rgba(236,72,153,0.9)] transition-all hover:bg-pink-500/25 active:scale-95"
                    >
                      <Camera className="h-3.5 w-3.5" /> Capture Frame
                    </button>
                  </div>
                </div>

                {/* Timestamp jump */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                    <input
                      type="text"
                      value={timestampInput}
                      onChange={e => setTimestampInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && captureAtTimestamp()}
                      placeholder="MM:SS.ms or HH:MM:SS (Enter to capture)"
                      className="h-10 w-full rounded-full border border-white/10 bg-black/30 pl-9 pr-4 text-xs text-white placeholder-white/30 focus:border-pink-400/60 focus:outline-none"
                    />
                  </div>
                  <button onClick={jumpToTimestamp}
                    className="h-10 rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:border-white/25 hover:text-white px-4 text-xs text-white/65">
                    Jump
                  </button>
                  <button onClick={captureAtTimestamp}
                    className="h-10 rounded-full border border-pink-400/40 bg-pink-500/15 px-4 text-xs font-semibold text-pink-100 transition-colors hover:bg-pink-500/25">
                    Capture
                  </button>
                </div>
              </div>

              {/* Right — settings + auto-scan */}
              <div className="space-y-4">

                {/* Auto Scan */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15"><ScanLine className="h-4 w-4 text-pink-300" /></span>
                    <p className="text-sm font-semibold text-white">Auto-Scan</p>
                  </div>
                  <p className="text-xs leading-relaxed text-white/50">Evenly extract frames across the full video automatically.</p>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-white/40">Number of frames</p>
                      <span className="text-xs text-pink-400 font-mono">{scanCount}</span>
                    </div>
                    <input type="range" min={2} max={60} step={1} value={scanCount}
                      onChange={e => setScanCount(+e.target.value)}
                      className="w-full accent-pink-400" />
                    <div className="flex justify-between text-[10px] text-white/20 mt-1">
                      <span>2 frames</span><span>60 frames</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[6, 12, 24, 48].map(n => (
                      <button key={n} onClick={() => setScanCount(n)}
                        className={`rounded-full border py-1.5 text-xs font-semibold transition-all
                          ${scanCount === n ? "border-pink-400/50 bg-pink-500/15 text-pink-100 shadow-[0_0_18px_-8px_rgba(236,72,153,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                        {n}
                      </button>
                    ))}
                  </div>

                  {scanning ? (
                    <div className="space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 shadow-[0_0_12px_rgba(244,114,182,0.8)] transition-all duration-300"
                          style={{ width: `${scanProgress}%` }} />
                      </div>
                      <p className="text-xs text-white/30 text-center">{scanProgress}% — scanning…</p>
                    </div>
                  ) : (
                    <button onClick={autoScan}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] text-sm font-semibold">
                      <Layers className="h-3.5 w-3.5" />
                      Scan {scanCount} Frames
                    </button>
                  )}
                </div>

                {/* Export settings */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Export Format</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["png", "jpg", "webp"] as ExportFormat[]).map(f => (
                      <button key={f} onClick={() => setOpt("format", f)}
                        className={`rounded-2xl border py-3 text-center transition-all
                          ${opts.format === f ? "border-pink-400/50 bg-pink-500/15 text-pink-100 shadow-[0_0_18px_-8px_rgba(236,72,153,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                        <p className={`text-sm font-bold uppercase ${opts.format === f ? "text-pink-100" : "text-white/70"}`}>{f}</p>
                        <p className="mt-0.5 text-[10px] text-white/40">
                          {f === "png" ? "Lossless" : f === "jpg" ? "Compressed" : "Best ratio"}
                        </p>
                      </button>
                    ))}
                  </div>

                  {opts.format !== "png" && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-white/40">Quality</p>
                        <span className="text-xs text-pink-400 font-mono">{Math.round(opts.quality * 100)}%</span>
                      </div>
                      <input type="range" min={10} max={100} step={1} value={Math.round(opts.quality * 100)}
                        onChange={e => setOpt("quality", +e.target.value / 100)}
                        className="w-full accent-pink-400" />
                    </div>
                  )}

                  <button onClick={() => setShowOpts(a => !a)}
                    className="flex w-full items-center gap-2 text-xs font-semibold text-white/50 transition-colors hover:text-white">
                    <Settings2 className="h-3.5 w-3.5" />
                    More options
                    <ChevronDown className={`ml-auto h-3 w-3 transition-transform ${showOpts ? "rotate-180" : ""}`} />
                  </button>

                  {showOpts && (
                    <div className="space-y-3 border-t border-white/[0.06] pt-3">
                      <div>
                        <p className="mb-2 text-xs text-white/40">Max dimension (0 = original)</p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[0, 4096, 1920, 1280, 720].map(d => (
                            <button key={d} onClick={() => setOpt("maxDim", d)}
                              className={`rounded-full border py-1.5 text-[10px] font-semibold transition-all
                                ${opts.maxDim === d ? "border-pink-400/50 bg-pink-500/15 text-pink-100 shadow-[0_0_18px_-8px_rgba(236,72,153,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                              {d === 0 ? "Orig" : `${d}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-white/40">Filename prefix</p>
                        <input type="text" value={opts.prefix} onChange={e => setOpt("prefix", e.target.value)}
                          className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white focus:border-pink-400/60 focus:outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Frame Gallery ── */}
            {frames.length > 0 && (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur">
                {/* Gallery toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15"><Camera className="h-4 w-4 text-pink-300" /></span>
                    <p className="text-sm font-semibold text-white">{frames.length} frame{frames.length !== 1 ? "s" : ""} captured</p>
                  </div>
                  {frames.length > 0 && (
                    <p className="text-xs text-white/30">{videoDims.w > 0 ? `${videoDims.w}×${videoDims.h} · ` : ""}{opts.format.toUpperCase()}</p>
                  )}
                  <div className="flex-1" />
                  {selectedIds.size > 0 && (
                    <p className="text-xs text-pink-400">{selectedIds.size} selected</p>
                  )}
                  {frames.length > 1 && (
                    <button onClick={selectedIds.size === frames.length ? deselectAll : selectAll}
                      className="rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:border-white/25 hover:text-white px-3 py-1.5 text-[11px] text-white/60">
                      {selectedIds.size === frames.length ? "Deselect all" : "Select all"}
                    </button>
                  )}
                  {selectedIds.size > 0 && (
                    <button onClick={deleteSelected}
                      className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20">
                      <Trash2 className="h-3 w-3" /> Delete ({selectedIds.size})
                    </button>
                  )}
                  <button
                    onClick={selectedIds.size > 0 ? downloadSelected : downloadAll}
                    className="flex items-center gap-1.5 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] px-4 py-2 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {selectedIds.size > 0 ? `Download ${selectedIds.size}` : `Download all ${frames.length}`}
                  </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {frames.map((frame, i) => {
                    const isSelected = selectedIds.has(frame.id);
                    return (
                      <div key={frame.id} className="group relative">
                        {/* Thumbnail */}
                        <div
                          onClick={() => toggleSelect(frame.id)}
                          className={`relative aspect-video cursor-pointer overflow-hidden rounded-2xl border-2 transition-all
                            ${isSelected ? "border-pink-400 shadow-[0_0_24px_-4px_rgba(236,72,153,0.7)]" : "border-white/[0.08] hover:-translate-y-0.5 hover:border-white/25"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={frame.dataUrl} alt={`Frame at ${fmtTimestampShort(frame.timestamp)}`}
                            className="h-full w-full object-cover" />
                          {/* Selected check */}
                          {isSelected && (
                            <div className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); setLightboxFrame(frame); }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); downloadFrame(frame, i); }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); deleteFrame(frame.id); }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/80 text-white transition-colors hover:bg-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Caption */}
                        <div className="mt-1.5 flex items-center justify-between px-0.5">
                          <span className="rounded-md bg-pink-500/15 px-1.5 py-0.5 font-mono text-[10px] text-pink-200/80">{fmtTimestampShort(frame.timestamp)}</span>
                          <span className="text-[10px] text-white/35">{frame.width}×{frame.height}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state when no frames yet */}
            {frames.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.015] py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-400/20 bg-pink-500/10">
                  <Camera className="h-7 w-7 text-pink-300/70" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/70">No frames captured yet</p>
                  <p className="mt-1 text-xs text-white/40">Scrub the video and click Capture Frame, or use Auto-Scan to extract frames automatically.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Lightbox ── */}
        {lightboxFrame && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setLightboxFrame(null)}>
            <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightboxFrame.dataUrl} alt="Frame preview"
                className="w-full rounded-3xl border border-white/10 shadow-2xl" />
              <div className="mt-3 flex items-center justify-between">
                <p className="font-mono text-sm text-white/60">
                  {fmtTimestampShort(lightboxFrame.timestamp)} · {lightboxFrame.width}×{lightboxFrame.height}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { downloadFrame(lightboxFrame, frames.indexOf(lightboxFrame)); }}
                    className="flex items-center gap-1.5 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] px-4 py-2 text-xs font-semibold">
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                  <button onClick={() => setLightboxFrame(null)}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:border-white/25 hover:text-white px-4 py-2 text-xs text-white/70">
                    <X className="h-3.5 w-3.5" /> Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Info cards ── */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: <Camera   className="h-5 w-5 text-pink-400"  />, title: "Frame-perfect capture",   body: "Scrub frame-by-frame with arrow controls. Snap at any exact moment with precise timestamp input." },
            { icon: <Grid3x3 className="h-5 w-5 text-rose-400"  />, title: "Auto-Scan mode",           body: "Extract 2–60 evenly-spaced frames across your video in one click. Perfect for storyboards." },
            { icon: <ZoomIn  className="h-5 w-5 text-fuchsia-400"/>, title: "Full-res PNG, JPG, WebP", body: "Frames are captured at full video resolution. Resize, adjust quality, and batch-download all at once." },
          ].map(c => (
            <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">{c.icon}</div>
              <p className="font-semibold text-white">{c.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-pink-400/20 bg-pink-500/[0.06] px-5 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
          <p className="text-xs leading-relaxed text-pink-100/70">
            <span className="font-semibold text-pink-200">Tip:</span> AVI, MKV, FLV, TS and other non-native formats are automatically converted for browser playback using FFmpeg — this takes a moment on first load, but all subsequent frame captures are instant.
          </p>
        </div>
      </div>
    </div>
  );
}
