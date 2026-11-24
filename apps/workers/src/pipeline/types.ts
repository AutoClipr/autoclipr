export type PipelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  checks?: string[];
};

export type TranscriptWord = {
  start: number;
  end: number;
  word: string;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  /** Word-level timings when Whisper returned them (used for animated captions). */
  words?: TranscriptWord[];
};

export type TranscriptResult = {
  text: string;
  segments: TranscriptSegment[];
  language?: string;
  /** True when Whisper was skipped (missing key, quota, etc.) */
  fallback?: boolean;
  fallback_reason?: string;
};

export type ViralMoment = {
  start_ms: number;
  end_ms: number;
  title: string;
  hook_text: string;
  viral_score: number;
  metrics: {
    hook_strength: number;
    engagement_prediction: number;
    retention_prediction: number;
    social_share_potential: number;
  };
};

export type UrlPipelinePayload = {
  video_id: string;
  source_url: string;
  source_type?: string;
  clip_count?: number;
  durations?: number[];
  caption_style?: string;
  caption_language?: string;
  platforms?: string[];
  export_quality?: string;
  auto_publish?: boolean;
  /** Plan limits set by the API from the user's tier — never client input. */
  plan_id?: string;
  max_video_seconds?: number;
  watermark?: boolean;
  /** Resolved brand kit (API-side, after plan + ownership checks). */
  brand?: BrandRenderConfig;
  /** Output ratio + Fill/Fit layout (API-validated against the plan). */
  layout?: import('./layout').LayoutConfig;
  /** User-uploaded SRT for the source video (videos bucket path). Replaces AI captions. */
  subtitle_srt_path?: string;
  /** AI Hook & Headline settings (validated and charged by the API). */
  hook?: import('./hooks').HookConfig & { credits?: number };
  /** Video enhancements (validated and charged by the API). */
  enhancements?: import('./enhance').Enhancements;
  /** Per-minute enhancement charge taken up front; settled after rendering. */
  enhancement_billing?: { per_minute: number; charged: number };
};

export type BrandRenderConfig = {
  kit_id: string;
  name: string;
  logo_path: string | null;
  logo: { position: string; size: number; opacity: number };
  intro_path: string | null;
  outro_path: string | null;
  max_bumper_seconds: number;
  caption_style: string | null;
  captions: import('./caption-styles').CaptionOverrides;
};

export type ClipRenderResult = {
  clipId: string;
  storagePath: string;
  thumbnailPath: string | null;
  subtitlePath: string | null;
  publicClipUrl: string | null;
  publicThumbUrl: string | null;
};
