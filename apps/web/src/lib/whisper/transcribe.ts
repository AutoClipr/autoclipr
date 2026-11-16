/**
 * Browser-side Whisper transcription shared by the free tools. The model runs
 * in a Web Worker (see whisper.worker.ts); audio never leaves the device.
 */

export type WhisperChunk = { start: number; end: number; text: string };
export type WhisperResult = { text: string; chunks: WhisperChunk[] };

export const WHISPER_MODELS = [
  { id: "onnx-community/whisper-base", label: "Accurate", note: "~80 MB, one-time" },
  { id: "onnx-community/whisper-tiny", label: "Fast", note: "~40 MB, one-time" },
] as const;

/** Whisper language names; null means auto-detect. */
export const WHISPER_LANGUAGES: { code: string | null; label: string }[] = [
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

/** Decode an audio/video file's bytes to 16 kHz mono samples. */
export async function decodeTo16kMono(buf: ArrayBuffer): Promise<Float32Array> {
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

type Opts = {
  model: string;
  language: string | null;
  /** Model download progress, 0–100 (only on first use). */
  onDownload?: (pct: number) => void;
  /** Model loaded; transcription has started. */
  onReady?: () => void;
};

/**
 * Transcribe 16 kHz mono samples. Returns the result promise and a cancel
 * function (which terminates the worker; the next call starts a fresh one).
 */
export function transcribeWithWhisper(audio: Float32Array, opts: Opts) {
  const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  const files = new Map<string, { loaded: number; total: number }>();
  let rejectFn: (e: Error) => void = () => {};

  const promise = new Promise<WhisperResult>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "download") {
        files.set(m.file, { loaded: m.loaded, total: m.total });
        let loaded = 0;
        let total = 0;
        files.forEach((f) => {
          loaded += f.loaded;
          total += f.total;
        });
        opts.onDownload?.(total ? Math.round((loaded / total) * 100) : 0);
      } else if (m.type === "ready") {
        opts.onReady?.();
      } else if (m.type === "done") {
        worker.terminate();
        resolve({ text: String(m.text).trim(), chunks: m.chunks });
      } else if (m.type === "error") {
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Transcription failed."));
    };
  });

  worker.postMessage(
    { type: "transcribe", audio, model: opts.model, language: opts.language },
    [audio.buffer],
  );

  return {
    promise,
    cancel: () => {
      worker.terminate();
      rejectFn(new Error("cancelled"));
    },
  };
}
