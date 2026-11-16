"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, Download, FileVideo, Zap, ShieldCheck, Globe,
  Loader2, AlertCircle, X, Info, RefreshCw, Settings2, ChevronDown,
  Play, Pause, SkipBack, SkipForward, Film, Repeat, Crop,
  Palette, Gauge, Clock, CheckCircle,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "ready" | "processing" | "done" | "error";

interface GifOpts {
  // Trim
  trimStart: number;
  trimEnd: number;
  // Size
  width: number;          // 0 = auto
  height: number;         // 0 = auto
  // Quality / speed
  fps: number;
  colors: number;         // 64 | 128 | 256
  dither: "none" | "bayer" | "floyd_steinberg";
  // Style
  loop: number;           // 0=infinite, 1=once, n=n times
  boomerang: boolean;     // ping-pong loop
  reverse: boolean;       // play reversed
  speed: number;          // 0.25 | 0.5 | 1 | 1.5 | 2
  // Output
  optimize: boolean;      // two-pass palette
}

const DEFAULT_OPTS: GifOpts = {
  trimStart: 0,
  trimEnd: 0,
  width: 480,
  height: 0,
  fps: 15,
  colors: 256,
  dither: "bayer",
  loop: 0,
  boomerang: false,
  reverse: false,
  speed: 1,
  optimize: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${String(m).padStart(2, "0")}:${sec.padStart(4, "0")}`;
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms  = Math.round((s % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${ms}`;
}

function gifDuration(opts: GifOpts): number {
  const clip = opts.trimEnd > opts.trimStart ? opts.trimEnd - opts.trimStart : 0;
  return clip / opts.speed;
}

function estimateSize(opts: GifOpts, vw: number): number {
  const w = opts.width > 0 ? opts.width : Math.min(vw, 480);
  const h = opts.height > 0 ? opts.height : Math.round(w * 9 / 16);
  const dur = gifDuration(opts);
  const frames = dur * opts.fps;
  const bytesPerFrame = (w * h * Math.log2(opts.colors)) / 8;
  const raw = frames * bytesPerFrame;
  const ditherMul = opts.dither === "none" ? 1 : 0.7;
  return Math.round(raw * ditherMul * (opts.optimize ? 0.6 : 1));
}

// ─── FFmpeg args ──────────────────────────────────────────────────────────────

function buildGifArgs(inName: string, paletteFile: string, outName: string, opts: GifOpts, vw: number, vh: number): {
  paletteArgs: string[];
  gifArgs: string[];
} {
  const w = opts.width  > 0 ? opts.width  : -1;
  const h = opts.height > 0 ? opts.height : -1;

  // Scale filter — keep aspect if only one dim set
  const scale = (w === -1 && h === -1)
    ? `scale=480:-1:flags=lanczos`
    : w === -1
      ? `scale=-1:${h}:flags=lanczos`
      : h === -1
        ? `scale=${w}:-1:flags=lanczos`
        : `scale=${w}:${h}:flags=lanczos`;

  const speedFilter = opts.speed !== 1 ? `setpts=${(1 / opts.speed).toFixed(3)}*PTS,` : "";
  const reverseFilter = opts.reverse ? "reverse," : "";

  // Dither string for paletteuse
  const ditherStr = opts.dither === "none"
    ? "dither=none"
    : opts.dither === "bayer"
      ? "dither=bayer:bayer_scale=5"
      : "dither=floyd_steinberg";

  const baseArgs: string[] = ["-y"];
  if (opts.trimStart > 0) baseArgs.push("-ss", String(opts.trimStart));
  baseArgs.push("-i", inName);
  const dur = opts.trimEnd > opts.trimStart ? opts.trimEnd - opts.trimStart : undefined;
  if (dur) baseArgs.push("-t", String(dur / opts.speed));

  const vfBase = `${speedFilter}${reverseFilter}fps=${opts.fps},${scale}`;

  // Palette generation pass
  const paletteArgs = [
    ...baseArgs,
    "-vf", `${vfBase},palettegen=max_colors=${opts.colors}:reserve_transparent=0`,
    paletteFile,
  ];

  // GIF generation pass
  const boomerangPart = opts.boomerang
    ? `[v]split[v1][v2];[v2]reverse[rv];[v1][rv]concat=n=2:v=1[vout];[vout]`
    : ``;

  let vfGif: string;
  if (opts.boomerang) {
    vfGif = `${vfBase}[v];${boomerangPart}[p]paletteuse=${ditherStr}`;
  } else {
    vfGif = `${vfBase}[x];[x][p]paletteuse=${ditherStr}`;
  }

  const loopVal = opts.loop === 0 ? 0 : opts.loop;

  const gifArgs = [
    ...baseArgs,
    "-i", paletteFile,
    "-filter_complex", vfGif,
    "-map", "[p]",
    "-loop", String(loopVal),
    outName,
  ];

  // Simpler fallback (no boomerang complex filter)
  const simpleGifArgs = [
    ...baseArgs,
    "-i", paletteFile,
    "-lavfi", `${vfBase}[x];[x][1:v]paletteuse=${ditherStr}`,
    "-loop", String(loopVal),
    outName,
  ];

  return { paletteArgs, gifArgs: simpleGifArgs };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GifGenerator() {
  const [stage, setStage]             = useState<Stage>("idle");
  const [file, setFile]               = useState<File | null>(null);
  const [videoUrl, setVideoUrl]       = useState<string | null>(null);
  const [videoDims, setVideoDims]     = useState({ w: 0, h: 0, dur: 0 });
  const [opts, setOpts]               = useState<GifOpts>(DEFAULT_OPTS);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]             = useState("");
  const [dragging, setDragging]       = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputUrl, setOutputUrl]     = useState<string | null>(null);
  const [outputSize, setOutputSize]   = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime]     = useState<number | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffLoaded  = useRef(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);

  const ACCEPT = "video/*,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.m4v,.3gp,.ts,.mts";
  const setOpt = <K extends keyof GifOpts>(k: K, v: GifOpts[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  const clipDur = opts.trimEnd > opts.trimStart ? opts.trimEnd - opts.trimStart : videoDims.dur;
  const estSize = videoDims.w > 0 ? estimateSize({ ...opts, trimEnd: opts.trimEnd || videoDims.dur }, videoDims.w) : 0;

  // ── Video controls ──
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onEnd  = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnd); };
  }, [videoUrl]);

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(t, videoDims.dur));
  };

  const setTrimStart = () => setOpt("trimStart", Math.floor(currentTime * 10) / 10);
  const setTrimEnd   = () => setOpt("trimEnd",   Math.ceil(currentTime * 10) / 10);

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

  // ── File pick ──
  const pickFile = (f: File) => {
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setStage("ready");
    setOutputUrl(null); setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setVideoDims({ w: v.videoWidth, h: v.videoHeight, dur: v.duration });
    setOpts(o => ({
      ...o,
      trimStart: 0,
      trimEnd: Math.min(v.duration, 6),
    }));
  };

  // ── Generate GIF ──
  const generate = async () => {
    if (!file) return;
    setStage("processing"); setProgress(5);
    setOutputUrl(null); setError("");

    try {
      setProgressMsg("Loading FFmpeg…");
      const ff = await loadFFmpeg();
      setProgress(10);

      const ext    = file.name.split(".").pop() ?? "mp4";
      const inName = `input.${ext}`;
      const paletteName = "palette.png";
      const outName = "output.gif";

      setProgressMsg("Reading video…");
      await ff.writeFile(inName, await fetchFile(file));
      setProgress(20);

      // ── Pass 1: generate palette ──
      setProgressMsg("Generating colour palette…");
      ff.on("progress", ({ progress: p }) => setProgress(Math.round(20 + p * 35)));

      const { paletteArgs, gifArgs } = buildGifArgs(inName, paletteName, outName, opts, videoDims.w, videoDims.h);
      const ret1 = await ff.exec(paletteArgs);
      if (ret1 !== 0) throw new Error("Failed to generate palette — try different settings.");
      setProgress(55);

      // ── Pass 2: render GIF ──
      setProgressMsg("Rendering GIF…");
      ff.on("progress", ({ progress: p }) => setProgress(Math.round(55 + p * 40)));
      const ret2 = await ff.exec(gifArgs);
      if (ret2 !== 0) throw new Error("Failed to generate GIF — try a shorter clip or lower FPS.");

      const data = await ff.readFile(outName) as Uint8Array;
      try {
        await ff.deleteFile(inName);
        await ff.deleteFile(paletteName);
        await ff.deleteFile(outName);
      } catch { /* ok */ }

      const blob = new Blob([data.buffer as ArrayBuffer], { type: "image/gif" });
      setOutputSize(blob.size);
      setOutputUrl(URL.createObjectURL(blob));
      setProgress(100);
      setStage("done");
    } catch (e: any) {
      setError(e?.message ?? "GIF generation failed.");
      setStage("error");
    }
  };

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = `${file?.name.replace(/\.[^.]+$/, "") ?? "animation"}.gif`;
    a.click();
  };

  const reset = () => {
    setStage("idle"); setFile(null); setVideoUrl(null);
    setOutputUrl(null); setError(""); setProgress(0);
    setVideoDims({ w: 0, h: 0, dur: 0 });
  };

  const pct = videoDims.dur > 0 ? (currentTime / videoDims.dur) * 100 : 0;

  const SIZE_PRESETS = [
    { label: "320px",  w: 320,  h: 0 },
    { label: "480px",  w: 480,  h: 0 },
    { label: "640px",  w: 640,  h: 0 },
    { label: "Square", w: 480,  h: 480 },
    { label: "Story",  w: 270,  h: 480 },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(234,179,8,0.18), transparent 70%), radial-gradient(30% 40% at 85% 10%, rgba(245,158,11,0.12), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl">

        {/* ── Header ── */}
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mx-auto mb-10 mt-8 max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/30 to-amber-500/15 shadow-[0_0_40px_-8px_rgba(234,179,8,0.7)]">
            <Film className="h-8 w-8 text-yellow-200" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            GIF{" "}
            <span className="bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-300 bg-clip-text text-transparent">Generator</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
            Turn any video moment into a sharp, looping GIF. Trim, resize, set FPS, boomerang or reverse.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "100% Private" },
              { icon: <Globe       className="h-3.5 w-3.5" />, label: "No Upload" },
              { icon: <Palette     className="h-3.5 w-3.5" />, label: "256-colour palette" },
              { icon: <Repeat      className="h-3.5 w-3.5" />, label: "Loop · Boomerang" },
            ].map(p => (
              <span key={p.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur">
                <span className="text-yellow-300">{p.icon}</span>{p.label}
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
                ${dragging ? "border-yellow-400/70 shadow-[0_0_60px_-10px_rgba(234,179,8,0.7)]" : "border-white/10 hover:border-yellow-400/40 hover:shadow-[0_0_60px_-16px_rgba(234,179,8,0.6)]"}`}
            >
              <div className={`relative flex flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-dashed px-6 py-20 transition-colors
                ${dragging ? "border-yellow-400/60 bg-yellow-500/10" : "border-white/10 bg-white/[0.02] group-hover:bg-white/[0.035]"}`}>
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
                {/* Looping GIF badge motif */}
                <div className="relative flex h-20 w-28 items-center justify-center rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/25 to-amber-500/10 shadow-[0_0_30px_-8px_rgba(234,179,8,0.8)] transition-transform duration-300 group-hover:-translate-y-1">
                  <span className="text-2xl font-black tracking-tight text-yellow-100">GIF</span>
                  <Repeat className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-[#07080f] p-1 text-yellow-300 ring-1 ring-yellow-400/40" />
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
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Upload", d: "Any video file. It stays on your device." },
                { n: "2", t: "Trim & tune", d: "Mark IN/OUT, pick size, FPS, loop and speed." },
                { n: "3", t: "Generate", d: "Preview the GIF and download it." },
              ].map(x => (
                <div key={x.n} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-xs font-bold text-yellow-200">{x.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{x.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">{x.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Workspace ── */}
        {stage !== "idle" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">

            {/* Left — video + trim */}
            <div className="space-y-4">

              {/* File bar */}
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-400">
                  <FileVideo className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{file?.name}</p>
                  <p className="text-xs text-white/40">{fmtBytes(file?.size ?? 0)} · {videoDims.w > 0 ? `${videoDims.w}×${videoDims.h}` : "—"} · {fmtTime(videoDims.dur)}</p>
                </div>
                <button onClick={reset} className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Video player */}
              {videoUrl && (
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/50">
                  <video ref={videoRef} src={videoUrl} className="w-full max-h-60" onLoadedMetadata={onMeta} />
                </div>
              )}

              {/* Player controls */}
              {videoDims.dur > 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-5">
                  {/* Scrubber */}
                  <div className="relative">
                    {/* Track */}
                    <div
                      className="relative h-6 cursor-pointer flex items-center"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekTo(((e.clientX - rect.left) / rect.width) * videoDims.dur);
                      }}
                      onMouseMove={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverTime(((e.clientX - rect.left) / rect.width) * videoDims.dur);
                      }}
                      onMouseLeave={() => setHoverTime(null)}
                    >
                      {/* Base track */}
                      <div className="h-2 w-full rounded-full bg-white/[0.08]" />

                      {/* Trim region highlight */}
                      <div
                        className="absolute h-2 rounded-full bg-gradient-to-r from-yellow-400/70 to-amber-400/70 shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                        style={{
                          left: `${(opts.trimStart / videoDims.dur) * 100}%`,
                          width: `${((opts.trimEnd - opts.trimStart) / videoDims.dur) * 100}%`,
                        }}
                      />

                      {/* Playhead */}
                      <div
                        className="absolute top-0.5 h-5 w-1 -translate-x-1/2 rounded-full bg-white shadow-lg"
                        style={{ left: `${pct}%` }}
                      />

                      {/* Trim start marker */}
                      <div
                        className="absolute top-0 h-6 w-1.5 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(250,204,21,0.9)]"
                        style={{ left: `${(opts.trimStart / videoDims.dur) * 100}%` }}
                      />
                      {/* Trim end marker */}
                      <div
                        className="absolute top-0 h-6 w-1.5 -translate-x-1/2 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(250,204,21,0.9)]"
                        style={{ left: `${(opts.trimEnd / videoDims.dur) * 100}%` }}
                      />

                      {/* Hover tooltip */}
                      {hoverTime !== null && (
                        <div className="absolute -top-7 -translate-x-1/2 rounded-lg bg-black/90 px-2 py-0.5 text-[10px] font-mono text-white pointer-events-none whitespace-nowrap"
                          style={{ left: `${(hoverTime / videoDims.dur) * 100}%` }}>
                          {fmtSec(hoverTime)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Playback controls */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const v = videoRef.current; if(v) v.currentTime = Math.max(0, v.currentTime - 5); }}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors">
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button onClick={togglePlay}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-[0_0_20px_-6px_rgba(255,255,255,0.6)] transition-transform hover:scale-105">
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => { const v = videoRef.current; if(v) v.currentTime = Math.min(videoDims.dur, v.currentTime + 5); }}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors">
                      <SkipForward className="h-4 w-4" />
                    </button>
                    <span className="ml-2 font-mono text-xs text-white/40">{fmtSec(currentTime)} / {fmtSec(videoDims.dur)}</span>
                  </div>

                  {/* Trim controls */}
                  <div className="flex items-center gap-2">
                    <button onClick={setTrimStart}
                      className="flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-500/15 px-4 py-2 text-xs font-semibold text-yellow-100 transition-all hover:bg-yellow-500/25">
                      Set IN <span className="font-mono text-yellow-400">{fmtSec(opts.trimStart)}</span>
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-xs text-white/45">Clip </span>
                      <span className="rounded-full bg-yellow-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-yellow-200">
                        {fmtSec(opts.trimEnd - opts.trimStart)}
                      </span>
                    </div>
                    <button onClick={setTrimEnd}
                      className="flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-500/15 px-4 py-2 text-xs font-semibold text-yellow-100 transition-all hover:bg-yellow-500/25">
                      Set OUT <span className="font-mono text-yellow-400">{fmtSec(opts.trimEnd)}</span>
                    </button>
                  </div>

                  {/* Manual trim sliders */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-white/30">Start</p>
                        <span className="font-mono text-[10px] text-yellow-400">{fmtSec(opts.trimStart)}</span>
                      </div>
                      <input type="range" min={0} max={videoDims.dur} step={0.1} value={opts.trimStart}
                        onChange={e => setOpt("trimStart", Math.min(+e.target.value, opts.trimEnd - 0.5))}
                        className="w-full accent-yellow-400" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-white/30">End</p>
                        <span className="font-mono text-[10px] text-yellow-400">{fmtSec(opts.trimEnd)}</span>
                      </div>
                      <input type="range" min={0} max={videoDims.dur} step={0.1} value={opts.trimEnd}
                        onChange={e => setOpt("trimEnd", Math.max(+e.target.value, opts.trimStart + 0.5))}
                        className="w-full accent-yellow-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* Progress */}
              {stage === "processing" && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                    <p className="font-semibold text-white">{progressMsg}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06] relative">
                    <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 shadow-[0_0_12px_rgba(250,204,21,0.8)] transition-all duration-300"
                      style={{ width: `${progress}%` }} />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/10 to-transparent animate-pulse" />
                  </div>
                  <p className="text-xs text-white/45">{progress}% — 2-pass palette render for best colour quality</p>
                </div>
              )}

              {/* Error */}
              {stage === "error" && (
                <div className="flex items-start gap-3 rounded-3xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-5">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-300">Generation failed</p>
                    <p className="mt-1 text-sm text-red-300/70">{error}</p>
                  </div>
                </div>
              )}

              {/* Done */}
              {stage === "done" && outputUrl && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-3xl border border-yellow-400/30 bg-black shadow-[0_0_50px_-20px_rgba(234,179,8,0.8)]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-yellow-300" />
                        <span className="text-xs font-semibold text-white">Your GIF is ready</span>
                      </div>
                      <span className="text-xs text-white/40">{fmtBytes(outputSize)}</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={outputUrl} alt="Generated GIF" className="w-full" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={download}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] text-sm font-semibold">
                      <Download className="h-4 w-4" /> Download GIF · {fmtBytes(outputSize)}
                    </button>
                    <button onClick={() => setStage("ready")}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:border-white/25 hover:text-white text-white/60" title="Make another">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right — settings */}
            <div className="space-y-4">

              {/* Estimated output */}
              {videoDims.dur > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-3 py-4 text-center">
                    <p className="text-lg font-extrabold text-yellow-200">{fmtSec(clipDur)}</p>
                    <p className="mt-0.5 text-[10px] text-white/45">Clip length</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-3 py-4 text-center">
                    <p className="text-lg font-extrabold text-white">{Math.round(clipDur * opts.fps)}</p>
                    <p className="mt-0.5 text-[10px] text-white/45">Frames</p>
                  </div>
                  <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/[0.08] px-3 py-4 text-center shadow-[0_0_30px_-14px_rgba(234,179,8,0.9)]">
                    <p className="text-lg font-extrabold text-yellow-200">~{fmtBytes(estSize)}</p>
                    <p className="mt-0.5 text-[10px] text-white/45">Est. size</p>
                  </div>
                </div>
              )}

              {/* Size presets */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Output Size</p>
                <div className="grid grid-cols-5 gap-1.5 mb-4">
                  {SIZE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => { setOpt("width", p.w); setOpt("height", p.h); }}
                      className={`rounded-full border py-2 text-[10px] font-semibold transition-all
                        ${opts.width === p.w && opts.height === p.h
                          ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]"
                          : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-[10px] text-white/45">Width (px, 0=auto)</p>
                    <input type="number" min={0} max={1920} step={10} value={opts.width}
                      onChange={e => setOpt("width", +e.target.value)}
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white focus:border-yellow-400/60 focus:outline-none" />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-white/45">Height (px, 0=auto)</p>
                    <input type="number" min={0} max={1920} step={10} value={opts.height}
                      onChange={e => setOpt("height", +e.target.value)}
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white focus:border-yellow-400/60 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* FPS */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Frame Rate</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[5, 10, 15, 20, 24].map(f => (
                    <button key={f} onClick={() => setOpt("fps", f)}
                      className={`rounded-full border py-2 text-xs font-bold transition-all
                        ${opts.fps === f ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-white/35">
                  <span>Smaller · smoother playback</span><span>Larger file</span>
                </div>
              </div>

              {/* Loop + Speed */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-5">
                {/* Loop */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Loop</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "∞", value: 0 },
                      { label: "1×", value: 1 },
                      { label: "3×", value: 3 },
                      { label: "5×", value: 5 },
                    ].map(l => (
                      <button key={l.value} onClick={() => setOpt("loop", l.value)}
                        className={`rounded-full border py-2 text-sm font-bold transition-all
                          ${opts.loop === l.value ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Speed</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0.25, 0.5, 1, 1.5, 2].map(s => (
                      <button key={s} onClick={() => setOpt("speed", s)}
                        className={`rounded-full border py-2 text-[10px] font-bold transition-all
                          ${opts.speed === s ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>

                {/* Boomerang / Reverse */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOpt("boomerang", !opts.boomerang)}
                    className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-xs font-semibold transition-all
                      ${opts.boomerang ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                    <Repeat className="h-3.5 w-3.5 shrink-0" />
                    Boomerang
                  </button>
                  <button onClick={() => setOpt("reverse", !opts.reverse)}
                    className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-xs font-semibold transition-all
                      ${opts.reverse ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                    <SkipBack className="h-3.5 w-3.5 shrink-0" />
                    Reverse
                  </button>
                </div>
              </div>

              {/* Advanced (dither, colors) */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-5">
                <button onClick={() => setShowAdvanced(a => !a)}
                  className="flex w-full items-center gap-2 text-xs font-semibold text-white/50 transition-colors hover:text-white">
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced (colour quality)
                  <ChevronDown className={`ml-auto h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>

                {showAdvanced && (
                  <div className="space-y-4 border-t border-white/[0.06] pt-4">
                    {/* Palette colours */}
                    <div>
                      <p className="mb-2 text-xs text-white/40">Palette colours</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([64, 128, 256] as const).map(c => (
                          <button key={c} onClick={() => setOpt("colors", c)}
                            className={`rounded-full border py-2 text-xs font-bold transition-all
                              ${opts.colors === c ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                            {c} colours
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dither */}
                    <div>
                      <p className="mb-2 text-xs text-white/40">Dithering</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: "none",            label: "None",    desc: "Fastest" },
                          { id: "bayer",           label: "Bayer",   desc: "Balanced" },
                          { id: "floyd_steinberg", label: "F-S",     desc: "Best" },
                        ] as const).map(d => (
                          <button key={d.id} onClick={() => setOpt("dither", d.id)}
                            className={`rounded-2xl border px-2 py-2.5 text-center transition-all
                              ${opts.dither === d.id ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100 shadow-[0_0_18px_-8px_rgba(250,204,21,0.9)]" : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                            <p className={`text-xs font-bold ${opts.dither === d.id ? "text-yellow-100" : "text-white/70"}`}>{d.label}</p>
                            <p className="mt-0.5 text-[10px] text-white/40">{d.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Generate button */}
              {(stage === "ready" || stage === "error") && (
                <button onClick={generate}
                  disabled={opts.trimEnd <= opts.trimStart || opts.trimEnd - opts.trimStart < 0.3}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] text-sm font-semibold disabled:opacity-40">
                  <Film className="h-4 w-4" />
                  Generate GIF
                  {estSize > 0 && (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold">
                      ~{fmtBytes(estSize)}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Tips ── */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: <Clock   className="h-5 w-5 text-yellow-400"  />, title: "Keep clips under 6s",    body: "GIFs grow fast. 3–6 seconds at 15 FPS and 480px wide is the sweet spot for small, sharp GIFs." },
            { icon: <Palette className="h-5 w-5 text-amber-400"  />, title: "2-pass palette engine",   body: "We generate an optimised colour palette from your exact clip before rendering — far better than single-pass." },
            { icon: <Repeat  className="h-5 w-5 text-orange-400" />, title: "Boomerang mode",          body: "Plays forward then backward in a seamless loop — perfect for reaction GIFs and social content." },
          ].map(c => (
            <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">{c.icon}</div>
              <p className="font-semibold text-white">{c.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-500/[0.06] px-5 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
          <p className="text-xs leading-relaxed text-yellow-100/70">
            <span className="font-semibold text-yellow-200">Tip:</span> GIF uses an indexed 256-colour palette, so bright or highly-varied footage can look grainy. For best results, use <span className="text-yellow-200">Floyd-Steinberg dithering</span> with 256 colours. Keep clips short — every extra second adds significant file size.
          </p>
        </div>
      </div>
    </div>
  );
}
