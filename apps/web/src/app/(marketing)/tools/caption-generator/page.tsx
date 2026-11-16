import type { Metadata } from "next";
import { CaptionGenerator } from "./caption-generator";
import { pageMetadata } from "@/lib/seo";
import { ToolJsonLd } from "@/components/seo/json-ld";
import { RelatedTools } from "@/components/tools/related-tools";

export const metadata: Metadata = pageMetadata({
  title: "Free AI Caption Generator — Auto-Transcribe Any Video",
  description:
    "Generate captions and subtitles from any video automatically with Whisper AI, running in your browser. Export as SRT, VTT, or TXT. Supports MP4, MOV, AVI, MKV, WebM. Free, no upload.",
  path: "/tools/caption-generator",
  keywords: [
    "caption generator", "auto caption video", "ai subtitles", "video transcription",
    "srt generator", "vtt captions", "subtitle maker", "free caption generator",
    "speech to text video", "auto subtitle generator",
  ],
});

const FAQS = [
  { q: "How does the automatic caption generation work?", a: "The tool runs OpenAI's open-source Whisper speech model directly in your browser. It extracts the audio track, transcribes it with timestamps and splits the result into caption lines." },
  { q: "What languages are supported?", a: "Whisper understands around 99 languages and can detect the spoken language automatically. You can also pick English, Hindi, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, Arabic, Russian and more." },
  { q: "What caption formats can I export?", a: "You can export as SRT (SubRip, works in most video players and editors), VTT (WebVTT, for web players), or plain TXT." },
  { q: "Is my video uploaded anywhere?", a: "No. Audio extraction and transcription both run locally in your browser. Only the AI model is downloaded once and cached; your video is never sent to a server." },
  { q: "Can I edit the captions after they're generated?", a: "Yes. Each caption line is editable inline. You can correct any transcript errors before exporting." },
];

export default function CaptionGeneratorPage() {
  return (
    <>
      <ToolJsonLd
        name="Free AI Caption Generator"
        description="Auto-generate SRT, VTT and TXT captions for any video using Whisper AI — free, in your browser."
        path="/tools/caption-generator"
        faqs={FAQS}
      />
      <CaptionGenerator />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <RelatedTools current="caption-generator" />
      </div>
    </>
  );
}
