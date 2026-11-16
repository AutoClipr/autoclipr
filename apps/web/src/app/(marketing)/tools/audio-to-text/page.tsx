import type { Metadata } from "next";
import { AudioToText } from "./audio-to-text";
import { pageMetadata } from "@/lib/seo";
import { ToolJsonLd } from "@/components/seo/json-ld";
import { RelatedTools } from "@/components/tools/related-tools";

export const metadata: Metadata = pageMetadata({
  title: "Free Audio to Text Converter — Transcribe Audio & Video with AI",
  description:
    "Extract text from any audio or video file with Whisper AI. MP3, WAV, M4A, MP4, MOV and more. Auto language detection, timestamps, TXT and SRT export. Free, private, no upload.",
  path: "/tools/audio-to-text",
  keywords: [
    "audio to text", "video to text", "transcribe audio", "speech to text",
    "mp3 to text", "extract text from video", "free transcription", "whisper transcription",
  ],
});

const FAQS = [
  { q: "How does it work?", a: "It runs OpenAI's open-source Whisper speech model directly in your browser. The audio is decoded and transcribed on your device." },
  { q: "Is my file uploaded?", a: "No. Your file never leaves your device. Only the AI model itself is downloaded once, then cached by your browser." },
  { q: "Which languages are supported?", a: "Whisper understands around 99 languages and can detect the spoken language automatically, or you can pick one." },
  { q: "Can I get timestamps?", a: "Yes. Turn on timestamps to see when each line was spoken, or download the transcript as an SRT subtitle file." },
  { q: "Fast or Accurate model?", a: "Fast uses Whisper Tiny (smaller download, quicker). Accurate uses Whisper Base, which makes fewer mistakes, especially with accents and background noise." },
];

export default function AudioToTextPage() {
  return (
    <>
      <ToolJsonLd
        name="Free Audio to Text Converter"
        description="Extract text from audio or video with Whisper AI — free, private, in your browser."
        path="/tools/audio-to-text"
        faqs={FAQS}
      />
      <AudioToText />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <RelatedTools current="audio-to-text" />
      </div>
    </>
  );
}
