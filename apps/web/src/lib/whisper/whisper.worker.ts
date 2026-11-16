/// <reference lib="webworker" />
/**
 * Runs Whisper locally in the browser (transformers.js + ONNX). The model is
 * fetched from the Hugging Face hub on first use and then cached by the
 * browser, so the audio itself never leaves the device.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

type InMsg = {
  type: "transcribe";
  audio: Float32Array;
  model: string;
  language: string | null; // null → auto-detect
};

// transformers.js' overloaded pipeline() type is too large for tsc to
// resolve, so it's narrowed to the one task used here.
const createAsr = pipeline as unknown as (
  task: "automatic-speech-recognition",
  model: string,
  opts: Record<string, unknown>,
) => Promise<AutomaticSpeechRecognitionPipeline>;

const pipes = new Map<string, Promise<AutomaticSpeechRecognitionPipeline>>();

function getPipe(model: string) {
  let p = pipes.get(model);
  if (!p) {
    p = createAsr("automatic-speech-recognition", model, {
      dtype: "q8",
      progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (e.status === "progress" && e.total) {
          self.postMessage({ type: "download", file: e.file, loaded: e.loaded, total: e.total });
        }
      },
    });
    pipes.set(model, p);
  }
  return p;
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const { audio, model, language } = e.data;
  try {
    const asr = await getPipe(model);
    self.postMessage({ type: "ready" });

    const out = await asr(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task: "transcribe",
      ...(language ? { language } : {}),
    });

    const result = Array.isArray(out) ? out[0] : out;
    self.postMessage({
      type: "done",
      text: result.text,
      chunks: (result.chunks ?? []).map((c) => ({
        start: c.timestamp[0] ?? 0,
        end: c.timestamp[1] ?? c.timestamp[0] ?? 0,
        text: c.text,
      })),
    });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
