"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, Download, FileVideo, Zap, ShieldCheck, Globe,
  Loader2, AlertCircle, X, Settings2, ChevronDown, Maximize2,
  Monitor, Smartphone, Square, Film, Crop, LayoutTemplate,
  RefreshCw, Info, CheckCircle,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "ready" | "processing" | "done" | "error";

interface AspectPreset {
  id: string;
  label: string;
  ratio: string;
  w: number;
  h: number;
  icon: React.ReactNode;
  description: string;
  platform?: string;
}

interface ConvertOpts {
  preset: string;
  customW: number;
  customH: number;
  fitMode: "crop" | "pad" | "stretch";
  padColor: string;
  outputFormat: string;
  quality: "high" | "medium" | "compressed";
  fps: "original" | "60" | "30" | "24";
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: AspectPreset[] = [
  { id: "16:9",  label: "16:9 Landscape",  ratio: "16:9",  w: 16, h: 9,  icon: <Monitor   className="h-4 w-4" />, description: "YouTube, Netflix, TV", platform: "YouTube · TV" },
  { id: "9:16",  label: "9:16 Portrait",   ratio: "9:16",  w: 9,  h: 16, icon: <Smartphone className="h-4 w-4" />, description: "TikTok, Reels, Shorts", platform: "TikTok · Reels · Shorts" },
  { id: "1:1",   label: "1:1 Square",      ratio: "1:1",   w: 1,  h: 1,  icon: <Square    className="h-4 w-4" />, description: "Instagram feed posts", platform: "Instagram" },
  { id: "4:5",   label: "4:5 Portrait",    ratio: "4:5",   w: 4,  h: 5,  icon: <Smartphone className="h-4 w-4" />, description: "Instagram portrait feed", platform: "Instagram" },
  { id: "4:3",   label: "4:3 Classic",     ratio: "4:3",   w: 4,  h: 3,  icon: <Monitor   className="h-4 w-4" />, description: "Old TV, presentations", platform: "Presentations" },
  { id: "21:9",  label: "21:9 Cinematic",  ratio: "21:9",  w: 21, h: 9,  icon: <Film      className="h-4 w-4" />, description: "Ultra-wide cinematic", platform: "Cinema" },
  { id: "2:1",   label: "2:1 Twitter",     ratio: "2:1",   w: 2,  h: 1,  icon: <Monitor   className="h-4 w-4" />, description: "Twitter / X banner", platform: "Twitter · X" },
  { id: "custom", label: "Custom",         ratio: "",      w: 0,  h: 0,  icon: <Crop      className="h-4 w-4" />, description: "Set your own ratio or resolution", platform: "Custom" },
];

const OUTPUT_FORMATS = ["mp4", "webm", "mov", "mkv"];

const QUALITY_MAP: Record<string, string> = { high: "20", medium: "26", compressed: "32" };

const DEFAULT_OPTS: ConvertOpts = {
  preset: "16:9",
  customW: 1920,
  customH: 1080,
  fitMode: "crop",
  padColor: "000000",
  outputFormat: "mp4",
  quality: "medium",
  fps: "original",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function detectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

function even(n: number): number { return Math.max(2, Math.floor(n / 2) * 2); }

// Given video dims and target ratio, compute output w/h
function computeOutputDims(
  vw: number, vh: number,
  tw: number, th: number,
  fitMode: "crop" | "pad" | "stretch",
): { w: number; h: number } {
  if (fitMode === "stretch") {
    // Use the video's own dimensions scaled to the target ratio while keeping area
    const area = vw * vh;
    const ratio = tw / th;
    const h = Math.sqrt(area / ratio);
    const w = h * ratio;
    return { w: even(w), h: even(h) };
  }
  // For crop and pad, fit the larger dimension to the video's relevant side
  const scaleByW = vw / tw;
  const scaleByH = vh / th;
  const scale = fitMode === "crop" ? Math.min(scaleByW, scaleByH) : Math.max(scaleByW, scaleByH);
  return { w: even(vw / scale), h: even(vh / scale) };
}

function buildFFmpegArgs(
  inName: string,
  outName: string,
  opts: ConvertOpts,
  vw: number,
  vh: number,
  hasFps: number,
): string[] {
  const preset = PRESETS.find(p => p.id === opts.preset)!;
  const tw = opts.preset === "custom" ? opts.customW : preset.w;
  const th = opts.preset === "custom" ? opts.customH : preset.h;

  const args: string[] = ["-y", "-i", inName];

  // FPS filter
  const fpsPart = opts.fps !== "original" ? `fps=${opts.fps},` : "";

  const crf = QUALITY_MAP[opts.quality];

  if (opts.fitMode === "crop") {
    // Scale so the smallest dimension fits the target, then crop the excess
    const { w: sw, h: sh } = computeOutputDims(vw, vh, tw, th, "crop");
    // Scale to fill target exactly
    const scaleW = tw * Math.ceil(vw / tw);
    const scaleH = th * Math.ceil(vh / th);
    // Simpler: scale with -2 and crop
    // Scale to ensure at least target w and h
    const scaleExpr = `scale='if(gt(a,${tw}/${th}),${even(th * tw / th)},-2)':'if(gt(a,${tw}/${th}),-2,${th})'`;
    // We pre-calculate to avoid ffmpeg expression parser issues
    // Compute scale that fills the frame
    const scaleRatioW = tw / vw;
    const scaleRatioH = th / vh;
    const fillScale = Math.max(scaleRatioW, scaleRatioH);
    const scaledW = even(vw * fillScale);
    const scaledH = even(vh * fillScale);
    const cropX = Math.floor((scaledW - tw) / 2);
    const cropY = Math.floor((scaledH - th) / 2);
    args.push(
      "-vf", `${fpsPart}scale=${scaledW}:${scaledH},crop=${tw}:${th}:${cropX}:${cropY}`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", crf,
      "-c:a", "aac", "-b:a", "192k",
    );
  } else if (opts.fitMode === "pad") {
    // Scale to fit inside target, pad the rest with colour
    const scaleRatioW = tw / vw;
    const scaleRatioH = th / vh;
    const fitScale = Math.min(scaleRatioW, scaleRatioH);
    const scaledW = even(vw * fitScale);
    const scaledH = even(vh * fitScale);
    const padX = Math.floor((tw - scaledW) / 2);
    const padY = Math.floor((th - scaledH) / 2);
    const color = opts.padColor.replace("#", "");
    args.push(
      "-vf", `${fpsPart}scale=${scaledW}:${scaledH},pad=${tw}:${th}:${padX}:${padY}:0x${color}`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", crf,
      "-c:a", "aac", "-b:a", "192k",
    );
  } else {
    // Stretch — just scale to exact target dims
    args.push(
      "-vf", `${fpsPart}scale=${tw}:${th}`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", crf,
      "-c:a", "aac", "-b:a", "192k",
    );
  }

  if (opts.outputFormat === "webm") {
    // Replace codec args
    const vfIdx = args.indexOf("-vf");
    const vfVal = args[vfIdx + 1];
    // Replace from -c:v onwards
    const base = args.slice(0, vfIdx + 2);
    return [...base, "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-crf", crf, "-b:v", "0", "-c:a", "libopus", "-b:a", "128k", outName];
  }

  args.push(outName);
  return args;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AspectRatioConverter() {
  const [stage, setStage]             = useState<Stage>("idle");
  const [file, setFile]               = useState<File | null>(null);
  const [videoUrl, setVideoUrl]       = useState<string | null>(null);
  const [videoDims, setVideoDims]     = useState({ w: 0, h: 0, fps: 0, dur: 0 });
  const [opts, setOpts]               = useState<ConvertOpts>(DEFAULT_OPTS);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]             = useState("");
  const [dragging, setDragging]       = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputUrl, setOutputUrl]     = useState<string | null>(null);
  const [outputSize, setOutputSize]   = useState(0);
  const [previewRatio, setPreviewRatio] = useState({ w: 16, h: 9 });

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffLoaded  = useRef(false);
  const fileRef   = useRef<HTMLInputElement>(null);

  const ACCEPT = "video/*,.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv,.m4v,.3gp,.ts,.mts";

  const setOpt = <K extends keyof ConvertOpts>(k: K, v: ConvertOpts[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  // Update preview ratio when preset changes
  useEffect(() => {
    const p = PRESETS.find(pr => pr.id === opts.preset);
    if (p && p.w > 0) setPreviewRatio({ w: p.w, h: p.h });
    else if (opts.preset === "custom") setPreviewRatio({ w: opts.customW, h: opts.customH });
  }, [opts.preset, opts.customW, opts.customH]);

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
    ff.on("progress", ({ progress: p }) => {
      setProgress(Math.round(10 + p * 88));
    });
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
    setOutputUrl(null);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  const onMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setVideoDims({ w: v.videoWidth, h: v.videoHeight, fps: 0, dur: v.duration });
  };

  // ── Convert ──
  const convert = async () => {
    if (!file || videoDims.w === 0) return;
    setStage("processing"); setProgress(5);
    setOutputUrl(null); setError("");

    try {
      setProgressMsg("Loading FFmpeg…");
      const ff = await loadFFmpeg();
      setProgress(10);
      setProgressMsg("Reading video…");

      const ext  = file.name.split(".").pop() ?? "mp4";
      const inName  = `input.${ext}`;
      const outName = `output.${opts.outputFormat}`;

      await ff.writeFile(inName, await fetchFile(file));
      setProgress(15);
      setProgressMsg("Converting…");

      const ffArgs = buildFFmpegArgs(inName, outName, opts, videoDims.w, videoDims.h, videoDims.fps);
      const ret = await ff.exec(ffArgs);
      if (ret !== 0) throw new Error("Conversion failed — check your file and try again.");

      const data = await ff.readFile(outName) as Uint8Array;
      try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch { /* ok */ }

      const mime = opts.outputFormat === "webm" ? "video/webm" : "video/mp4";
      const blob = new Blob([data.buffer as ArrayBuffer], { type: mime });
      setOutputSize(blob.size);
      setOutputUrl(URL.createObjectURL(blob));
      setProgress(100);
      setStage("done");
    } catch (e: any) {
      setError(e?.message ?? "Conversion failed.");
      setStage("error");
    }
  };

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    const base = file?.name.replace(/\.[^.]+$/, "") ?? "video";
    const preset = PRESETS.find(p => p.id === opts.preset);
    const suffix = preset?.id.replace(":", "x") ?? "converted";
    a.download = `${base}_${suffix}.${opts.outputFormat}`;
    a.click();
  };

  const reset = () => {
    setStage("idle"); setFile(null); setVideoUrl(null);
    setOutputUrl(null); setError(""); setProgress(0);
    setVideoDims({ w: 0, h: 0, fps: 0, dur: 0 });
  };

  const selectedPreset = PRESETS.find(p => p.id === opts.preset)!;
  const targetW = opts.preset === "custom" ? opts.customW : selectedPreset.w;
  const targetH = opts.preset === "custom" ? opts.customH : selectedPreset.h;

  // Preview box aspect ratio
  const maxPW = 180; const maxPH = 140;
  const pw = previewRatio.w; const ph = previewRatio.h;
  const scale = Math.min(maxPW / pw, maxPH / ph);
  const boxW = Math.round(pw * scale); const boxH = Math.round(ph * scale);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080f] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(249,115,22,0.2), transparent 70%), radial-gradient(30% 40% at 85% 10%, rgba(244,63,94,0.12), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl">

        {/* ── Header ── */}
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Tools
        </Link>
        <div className="mx-auto mb-10 mt-8 max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/30 to-rose-500/15 shadow-[0_0_40px_-8px_rgba(249,115,22,0.7)]">
            <Crop className="h-8 w-8 text-orange-200" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Aspect Ratio{" "}
            <span className="bg-gradient-to-r from-orange-200 via-orange-300 to-rose-300 bg-clip-text text-transparent">Converter</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
            Turn a 16:9 video into 9:16, 1:1 or any size — crop, pad or stretch, right in your browser.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "100% Private" },
              { icon: <Globe       className="h-3.5 w-3.5" />, label: "No Upload" },
              { icon: <Zap         className="h-3.5 w-3.5" />, label: "Crop · Pad · Stretch" },
              { icon: <LayoutTemplate className="h-3.5 w-3.5" />, label: "7 Platform Presets" },
            ].map(p => (
              <span key={p.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur">
                <span className="text-orange-300">{p.icon}</span>{p.label}
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
                ${dragging ? "border-orange-400/70 shadow-[0_0_60px_-10px_rgba(249,115,22,0.7)]" : "border-white/10 hover:border-orange-400/40 hover:shadow-[0_0_60px_-16px_rgba(249,115,22,0.6)]"}`}
            >
              <div className={`relative flex flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-dashed px-6 py-20 transition-colors
                ${dragging ? "border-orange-400/60 bg-orange-500/10" : "border-white/10 bg-white/[0.02] group-hover:bg-white/[0.035]"}`}>
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/15 blur-3xl" aria-hidden />
                {/* 16:9 → 9:16 motif */}
                <div className="relative flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex h-12 w-20 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-[10px] font-bold text-white/50">16:9</div>
                  <Upload className="h-5 w-5 rotate-90 text-orange-300" />
                  <div className="flex h-20 w-12 items-center justify-center rounded-xl border border-orange-400/50 bg-orange-500/15 text-[10px] font-bold text-orange-200 shadow-[0_0_24px_-6px_rgba(249,115,22,0.8)]">9:16</div>
                </div>
                <div className="relative text-center">
                  <p className="text-xl font-bold text-white">Drop your video here</p>
                  <p className="mt-1.5 text-sm text-white/45">or click to browse · MP4, MOV, AVI, MKV, WebM, FLV, TS, 3GP…</p>
                </div>
                <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)] transition-shadow group-hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.65)]">
                  <Upload className="h-4 w-4" /> Choose a file
                </span>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Upload", d: "Any video file. It stays on your device." },
                { n: "2", t: "Pick a ratio", d: "TikTok, Reels, Shorts, square or custom size." },
                { n: "3", t: "Convert", d: "Crop, pad or stretch, then download." },
              ].map(x => (
                <div key={x.n} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-200">{x.n}</span>
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

            {/* Left column */}
            <div className="space-y-4">

              {/* File bar */}
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                  <FileVideo className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{file?.name}</p>
                  <p className="text-xs text-white/40">
                    {fmtBytes(file?.size ?? 0)} · {videoDims.w > 0 ? `${videoDims.w}×${videoDims.h} (${detectRatio(videoDims.w, videoDims.h)})` : "—"} · {fmtTime(videoDims.dur)}
                  </p>
                </div>
                <button onClick={reset} className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Video preview */}
              {videoUrl && (
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/50">
                  <video src={videoUrl} controls className="w-full max-h-64" onLoadedMetadata={onMeta} />
                </div>
              )}

              {/* Output preview */}
              {stage === "done" && outputUrl && (
                <div className="overflow-hidden rounded-3xl border border-orange-400/30 bg-black shadow-[0_0_50px_-20px_rgba(249,115,22,0.8)]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-200"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Output preview</span>
                    <span className="text-xs text-white/40">{fmtBytes(outputSize)} · {targetW}×{targetH}</span>
                  </div>
                  <video src={outputUrl} controls className="w-full max-h-64" />
                </div>
              )}

              {/* Progress */}
              {stage === "processing" && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                    <p className="font-semibold text-white">{progressMsg}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-400 shadow-[0_0_12px_rgba(251,146,60,0.8)] transition-all duration-300"
                      style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-white/45">{progress}% complete</p>
                </div>
              )}

              {/* Error */}
              {stage === "error" && (
                <div className="flex items-start gap-3 rounded-3xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-5">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-300">Conversion failed</p>
                    <p className="mt-1 text-sm text-red-300/70">{error}</p>
                  </div>
                </div>
              )}

              {/* Done actions */}
              {stage === "done" && outputUrl && (
                <div className="flex gap-3">
                  <button onClick={download}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] text-sm font-semibold">
                    <Download className="h-4 w-4" /> Download {opts.outputFormat.toUpperCase()}
                  </button>
                  <button onClick={() => setStage("ready")}
                    className="flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:border-white/25 hover:text-white px-5 text-sm text-white/70">
                    <RefreshCw className="h-4 w-4" /> Re-convert
                  </button>
                </div>
              )}
            </div>

            {/* Right column — settings */}
            <div className="space-y-4">

              {/* Aspect ratio presets */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Target Ratio</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setOpt("preset", p.id)}
                      className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-all
                        ${opts.preset === p.id
                          ? "border-orange-400/50 bg-orange-500/15 text-orange-100 shadow-[0_0_18px_-8px_rgba(251,146,60,0.9)]"
                          : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}
                    >
                      <span className={opts.preset === p.id ? "text-orange-300" : "text-white/35"}>{p.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{p.label}</p>
                        <p className="truncate text-[10px] text-white/40">{p.platform}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom dimensions */}
                {opts.preset === "custom" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs text-white/40">Width (px)</p>
                      <input type="number" min={2} max={7680} value={opts.customW}
                        onChange={e => setOpt("customW", +e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white focus:border-orange-400/60 focus:outline-none" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-white/40">Height (px)</p>
                      <input type="number" min={2} max={7680} value={opts.customH}
                        onChange={e => setOpt("customH", +e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white focus:border-orange-400/60 focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Fit mode */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Fit Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "crop",    label: "Crop",    desc: "Fill & cut edges" },
                    { id: "pad",     label: "Pad",     desc: "Add black bars" },
                    { id: "stretch", label: "Stretch", desc: "Distort to fit" },
                  ] as const).map(m => (
                    <button key={m.id} onClick={() => setOpt("fitMode", m.id)}
                      className={`rounded-2xl border px-3 py-3 text-center transition-all
                        ${opts.fitMode === m.id
                          ? "border-orange-400/50 bg-orange-500/15 text-orange-100 shadow-[0_0_18px_-8px_rgba(251,146,60,0.9)]"
                          : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                      <p className={`text-sm font-semibold ${opts.fitMode === m.id ? "text-orange-100" : "text-white/70"}`}>{m.label}</p>
                      <p className="mt-0.5 text-[10px] text-white/40">{m.desc}</p>
                    </button>
                  ))}
                </div>

                {opts.fitMode === "pad" && (
                  <div className="mt-3 flex items-center gap-3">
                    <p className="text-xs text-white/40">Bar colour</p>
                    <input type="color" value={`#${opts.padColor}`}
                      onChange={e => setOpt("padColor", e.target.value.replace("#", ""))}
                      className="h-8 w-14 cursor-pointer rounded-lg border-0 bg-transparent" />
                    <span className="text-xs text-white/30">#{opts.padColor}</span>
                  </div>
                )}
              </div>

              {/* Ratio preview box */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Preview</p>
                <div className="flex items-center justify-center gap-6">
                  {/* Original */}
                  {videoDims.w > 0 && (() => {
                    const od = gcd(videoDims.w, videoDims.h);
                    const orw = videoDims.w / od; const orh = videoDims.h / od;
                    const os = Math.min(maxPW / orw, maxPH / orh);
                    const ow = Math.round(orw * os); const oh = Math.round(orh * os);
                    return (
                      <div className="text-center">
                        <div className="flex items-end justify-center" style={{ height: maxPH }}>
                          <div className="flex items-center justify-center rounded-xl border-2 border-white/20 bg-white/[0.04]"
                            style={{ width: ow, height: oh }}>
                            <span className="text-[9px] text-white/30">{videoDims.w}×{videoDims.h}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-white/30">Original</p>
                      </div>
                    );
                  })()}

                  <div className="text-lg text-orange-300/70">→</div>

                  {/* Target */}
                  <div className="text-center">
                    <div className="flex items-end justify-center" style={{ height: maxPH }}>
                      <div className="flex items-center justify-center rounded-xl border-2 border-orange-400/60 bg-orange-500/15 shadow-[0_0_30px_-8px_rgba(249,115,22,0.8)] transition-all duration-300"
                        style={{ width: boxW, height: boxH }}>
                        <span className="text-[9px] font-semibold text-orange-200">{targetW}×{targetH}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] font-semibold text-orange-200">
                      {opts.preset === "custom" ? "Custom" : selectedPreset.ratio}
                    </p>
                  </div>
                </div>
              </div>

              {/* Output format + quality */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur space-y-4 p-5">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Output Format</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {OUTPUT_FORMATS.map(f => (
                      <button key={f} onClick={() => setOpt("outputFormat", f)}
                        className={`rounded-full border py-2 text-xs font-bold uppercase transition-all
                          ${opts.outputFormat === f
                            ? "border-orange-400/50 bg-orange-500/15 text-orange-100 shadow-[0_0_18px_-8px_rgba(251,146,60,0.9)]"
                            : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced */}
                <button onClick={() => setShowAdvanced(a => !a)}
                  className="flex items-center gap-2 text-xs font-semibold text-white/50 transition-colors hover:text-white">
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced options
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>

                {showAdvanced && (
                  <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                    <div>
                      <p className="mb-2 text-xs text-white/40">Quality</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["high", "medium", "compressed"] as const).map(q => (
                          <button key={q} onClick={() => setOpt("quality", q)}
                            className={`rounded-full border py-2 text-xs capitalize transition-all
                              ${opts.quality === q
                                ? "border-orange-400/50 bg-orange-500/15 text-orange-100 shadow-[0_0_18px_-8px_rgba(251,146,60,0.9)]"
                                : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"}`}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs text-white/40">Frame Rate</p>
                      <div className="relative">
                        <select value={opts.fps} onChange={e => setOpt("fps", e.target.value as ConvertOpts["fps"])}
                          className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-4 text-xs text-white focus:border-orange-400/60 focus:outline-none">
                          <option value="original" className="bg-[#0d0d1a]">Original FPS</option>
                          <option value="60" className="bg-[#0d0d1a]">60 FPS</option>
                          <option value="30" className="bg-[#0d0d1a]">30 FPS</option>
                          <option value="24" className="bg-[#0d0d1a]">24 FPS</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-3 w-3 text-white/40" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Convert button */}
              {(stage === "ready" || stage === "error") && (
                <button
                  onClick={convert}
                  disabled={videoDims.w === 0}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-black shadow-[0_0_30px_-6px_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.6)] active:scale-[0.98] text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Crop className="h-4 w-4" />
                  Convert to {opts.preset === "custom" ? `${opts.customW}×${opts.customH}` : selectedPreset.ratio}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Platform presets info ── */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "YouTube",  ratio: "16:9",  res: "1920×1080",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
            { label: "TikTok",   ratio: "9:16",  res: "1080×1920",  color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/20" },
            { label: "Instagram",ratio: "1:1",   res: "1080×1080",  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
            { label: "Reels",    ratio: "9:16",  res: "1080×1920",  color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
          ].map(p => (
            <div key={p.label} className={`rounded-3xl border ${p.border} ${p.bg} p-5 transition-transform hover:-translate-y-0.5`}>
              <p className={`text-lg font-extrabold ${p.color}`}>{p.label}</p>
              <p className="mt-1 text-sm text-white/55">{p.ratio} · {p.res}</p>
            </div>
          ))}
        </div>

        {/* ── Info cards ── */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: <Crop       className="h-5 w-5 text-orange-400" />, title: "Smart Crop", body: "Center-cropped to fill the target ratio perfectly — no black bars, no distortion." },
            { icon: <Maximize2  className="h-5 w-5 text-amber-400"  />, title: "Letterbox / Pillarbox", body: 'Choose Pad mode to add bars instead of cropping. Pick any bar colour — black is default.' },
            { icon: <Film       className="h-5 w-5 text-yellow-400" />, title: "All formats", body: "MP4, MOV, AVI, MKV, WebM, FLV, TS, 3GP — any video file, converted in your browser." },
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

        {/* Note */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-400/20 bg-orange-500/[0.06] px-5 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          <p className="text-xs leading-relaxed text-orange-100/70">
            <span className="font-semibold text-orange-200">Processing happens 100% in your browser.</span>{" "}
            Your video never leaves your device. Large files (1 GB+) may take a minute — processing time depends on your device.
          </p>
        </div>
      </div>
    </div>
  );
}
