export type LandingPage = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  subtitle: string;
  heroCta: string;
  benefits: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  /** Comparison pages: a feature table against another tool. */
  comparison?: {
    competitor: string;
    rows: { feature: string; autoclipr: string; competitor: string }[];
    note: string;
  };
};

const COMPARISON_NOTE =
  "Competitor details are based on their public websites at the time of writing and may have changed — check their site for current plans and pricing. OpusClip and Vizard are trademarks of their respective owners; AutoClipr is not affiliated with them.";

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "youtube-to-tiktok",
    title: "YouTube to TikTok Converter",
    description:
      "Convert YouTube videos to TikTok clips automatically. AI finds viral moments, adds captions, and exports vertical 9:16 videos ready to post.",
    keywords: [
      "YouTube to TikTok",
      "convert YouTube to TikTok",
      "YouTube video to TikTok",
      "repurpose YouTube for TikTok",
      "AI TikTok clips",
    ],
    h1: "Turn YouTube videos into TikTok clips",
    subtitle:
      "Paste any YouTube link. AutoClipr detects hooks, trims the best moments, burns in captions, and exports TikTok-ready vertical videos — no manual editing.",
    heroCta: "Convert YouTube to TikTok free",
    benefits: [
      {
        title: "AI hook detection",
        body: "Our models scan transcripts and pacing to surface moments that perform on TikTok — intros, punchlines, and emotional peaks.",
      },
      {
        title: "Auto captions",
        body: "Viral-style subtitles are generated and burned in. No CapCut timeline work for every clip.",
      },
      {
        title: "9:16 export",
        body: "Every clip exports in vertical Full HD — the format TikTok, Reels, and Shorts expect.",
      },
    ],
    steps: [
      { title: "Paste YouTube URL", body: "Drop a public YouTube link or upload an MP4 file directly." },
      { title: "Pick clip count & style", body: "Choose how many clips, caption style, and target platforms." },
      { title: "Download & post", body: "Review AI-selected clips and publish to TikTok in minutes." },
    ],
    faq: [
      {
        q: "Can I convert any YouTube video to TikTok?",
        a: "Public YouTube videos work best. Private or members-only videos require a direct file upload instead.",
      },
      {
        q: "Do I need editing experience?",
        a: "No. AutoClipr handles trimming, captions, and vertical formatting automatically.",
      },
      {
        q: "How many TikTok clips can I get from one video?",
        a: "You choose the clip count per import — typically 3–10 strong moments from a long-form video.",
      },
    ],
  },
  {
    slug: "youtube-to-shorts",
    title: "YouTube to Shorts Maker",
    description:
      "Repurpose long YouTube videos into YouTube Shorts with AI. Auto-detect viral segments, add captions, and export vertical clips in minutes.",
    keywords: [
      "YouTube to Shorts",
      "YouTube Shorts maker",
      "long video to Shorts",
      "AI YouTube Shorts",
      "repurpose YouTube content",
    ],
    h1: "Repurpose long videos into YouTube Shorts",
    subtitle:
      "Grow your Shorts channel without filming new content every day. AutoClipr clips your existing YouTube library into scroll-stopping Shorts.",
    heroCta: "Make YouTube Shorts with AI",
    benefits: [
      {
        title: "Grow without extra filming",
        body: "One podcast or tutorial can become a week of Shorts — same message, new reach.",
      },
      {
        title: "Caption styles that retain viewers",
        body: "Bold viral captions keep mobile viewers watching through the hook.",
      },
      {
        title: "Post to Shorts & beyond",
        body: "Export once and reuse on TikTok, Instagram Reels, and LinkedIn.",
      },
    ],
    steps: [
      { title: "Import your long video", body: "YouTube URL or file upload — both work." },
      { title: "Let AI find Shorts moments", body: "Whisper transcription + hook analysis rank the best segments." },
      { title: "Publish Shorts faster", body: "Download clips or connect YouTube to post Shorts directly." },
    ],
    faq: [
      {
        q: "What length works best for Shorts?",
        a: "AutoClipr targets 15–60 second clips — the sweet spot for Shorts retention.",
      },
      {
        q: "Will Shorts hurt my main channel?",
        a: "Shorts typically drive discovery. Repurposing proven content is a common growth strategy.",
      },
      {
        q: "Can I customize captions?",
        a: "Yes — pick viral, minimal, or other caption styles before export.",
      },
    ],
  },
  {
    slug: "youtube-to-instagram-reels",
    title: "YouTube to Instagram Reels",
    description:
      "Transform YouTube videos into Instagram Reels with AI clipping, auto captions, and vertical export. Repurpose content for Instagram growth.",
    keywords: [
      "YouTube to Instagram Reels",
      "convert YouTube to Reels",
      "repurpose YouTube for Instagram",
      "AI Reels maker",
      "Instagram video repurposing",
    ],
    h1: "Convert YouTube videos to Instagram Reels",
    subtitle:
      "Stop rebuilding the same content for Instagram. AutoClipr turns your YouTube uploads into Reels-ready vertical clips with captions baked in.",
    heroCta: "Create Reels from YouTube",
    benefits: [
      {
        title: "Instagram-native format",
        body: "9:16 vertical video with safe caption zones for mobile feeds.",
      },
      {
        title: "Multi-platform from one import",
        body: "Select Instagram, TikTok, and YouTube Shorts in a single workflow.",
      },
      {
        title: "Creator-friendly credits",
        body: "Pay per clip with credits — scale up only when you need more output.",
      },
    ],
    steps: [
      { title: "Add your source video", body: "Paste a YouTube link or upload MP4/MOV/WebM." },
      { title: "Select Instagram as a target", body: "Choose Reels alongside other platforms in one pass." },
      { title: "Export and schedule", body: "Download clips or post when your Instagram connection is live." },
    ],
    faq: [
      {
        q: "What video quality do Reels exports use?",
        a: "Full HD 1080×1920 vertical — suitable for Instagram Reels and Stories cross-posting.",
      },
      {
        q: "Do captions work on Instagram?",
        a: "Burned-in captions display consistently on Instagram without relying on auto-caption APIs.",
      },
      {
        q: "Can agencies use AutoClipr for clients?",
        a: "Yes — credit-based pricing scales for teams managing multiple creator accounts.",
      },
    ],
  },
  {
    slug: "podcast-to-clips",
    title: "Podcast to Short Clips",
    description:
      "Turn podcast episodes into viral short clips for TikTok, Reels, and Shorts. AI transcription finds the best quotes and moments automatically.",
    keywords: [
      "podcast to clips",
      "podcast to TikTok",
      "podcast audiogram",
      "podcast video clips AI",
      "repurpose podcast content",
    ],
    h1: "Turn podcasts into viral short clips",
    subtitle:
      "Your best podcast moments are buried in hour-long episodes. AutoClipr transcribes, ranks hooks, and exports short vertical clips — no video editor required.",
    heroCta: "Clip my podcast free",
    benefits: [
      {
        title: "Transcript-first clipping",
        body: "Whisper-powered transcription finds quotable lines and debate moments automatically.",
      },
      {
        title: "Video or audio sources",
        body: "YouTube podcast videos, Zoom recordings, or uploaded MP4 files all work.",
      },
      {
        title: "Built for talk-heavy content",
        body: "Hook analysis is tuned for interviews, commentary, and educational podcasts.",
      },
    ],
    steps: [
      { title: "Upload or link your episode", body: "YouTube podcast video or direct file upload." },
      { title: "AI picks highlight moments", body: "DeepSeek/GPT analysis scores segments for shareability." },
      { title: "Share clips everywhere", body: "Export to TikTok, Reels, Shorts, and LinkedIn from one job." },
    ],
    faq: [
      {
        q: "Do I need video podcasts?",
        a: "Video podcasts work best. Audio-only files need a video track for full export — upload video podcasts or recorded streams.",
      },
      {
        q: "How accurate are transcripts?",
        a: "We use OpenAI Whisper for high-quality captions across English and multiple languages.",
      },
      {
        q: "How long can podcast episodes be?",
        a: "Long episodes are supported — processing time scales with duration.",
      },
    ],
  },
  {
    slug: "schedule-youtube-shorts-and-reels",
    title: "Schedule YouTube Shorts & Instagram Reels",
    description:
      "Schedule YouTube Shorts and Instagram Reels on a content calendar and let AutoClipr auto-publish them on time. Retries, timezone support and email alerts. Creator & Business plans.",
    keywords: [
      "schedule YouTube Shorts",
      "schedule Instagram Reels",
      "Shorts scheduler",
      "Reels scheduler",
      "auto publish YouTube Shorts",
      "content calendar for creators",
      "social media scheduler for video",
    ],
    h1: "Schedule YouTube Shorts and Instagram Reels",
    subtitle:
      "Plan a week of short-form posts in one sitting. Put your clips on a calendar and AutoClipr publishes them at the right time — even when your laptop is closed.",
    heroCta: "Start scheduling",
    benefits: [
      {
        title: "Content calendar",
        body: "See every post in month, week or list view. Drag a post to another day to reschedule it — the time of day stays the same.",
      },
      {
        title: "Auto-publish to Shorts & Reels",
        body: "Post to YouTube Shorts, Instagram Reels or both, with a different caption per platform when you need one.",
      },
      {
        title: "Reliable by design",
        body: "Temporary platform errors are retried automatically, and you get an email when a post goes live or needs attention.",
      },
    ],
    steps: [
      { title: "Pick a clip", body: "Choose a clip AutoClipr made for you, or upload your own video up to 500 MB." },
      { title: "Write the caption", body: "Add a caption and hashtags, with optional per-platform versions for Shorts and Reels." },
      { title: "Set the time", body: "Choose the platforms, date, time and timezone. AutoClipr publishes it for you." },
    ],
    faq: [
      {
        q: "Which plans include the Content Scheduler?",
        a: "The Content Scheduler is included in the Creator and Business plans. On the free Starter plan you can still create clips and post them yourself.",
      },
      {
        q: "Which platforms can I schedule to?",
        a: "YouTube Shorts and Instagram Reels, using the accounts you connect in AutoClipr. You can post the same clip to both at once.",
      },
      {
        q: "Do I need to keep my computer on?",
        a: "No. Scheduled posts are published from AutoClipr's servers at the time you choose, whether or not you're online.",
      },
      {
        q: "What if a post fails to publish?",
        a: "AutoClipr retries temporary errors automatically, up to three attempts. If something needs your attention, like a disconnected account, you get an email and can retry with one click.",
      },
      {
        q: "Can I schedule in my own timezone?",
        a: "Yes. Pick the time in any timezone and AutoClipr converts it correctly, including around daylight-saving changes.",
      },
    ],
  },
  {
    slug: "opusclip-alternative",
    title: "AutoClipr vs OpusClip: The OpusClip Alternative",
    description:
      "Looking for an OpusClip alternative? Compare AutoClipr and OpusClip on AI clipping, captions, scheduling and pricing. Turn long videos into Shorts, Reels and TikToks — start free with 30 credits.",
    keywords: [
      "OpusClip alternative",
      "AutoClipr vs OpusClip",
      "OpusClip vs AutoClipr",
      "Opus Clip alternative",
      "OpusClip free alternative",
      "apps like OpusClip",
      "AI clip generator",
      "AI shorts generator",
    ],
    h1: "The OpusClip alternative for creators who post every day",
    subtitle:
      "AutoClipr finds the best moments in your long videos, adds captions and exports vertical clips — then schedules them to YouTube Shorts and Instagram Reels for you. Clip and publish from one place.",
    heroCta: "Try AutoClipr free",
    benefits: [
      {
        title: "Clip and post in one tool",
        body: "Make clips, then put them on a content calendar and let AutoClipr publish to Shorts and Reels on time. No second scheduling app.",
      },
      {
        title: "Pay per clip with credits",
        body: "Credits are spent only on the clips you make, and you see the exact cost before you click Create. Start with 30 free credits, no card needed.",
      },
      {
        title: "Captions in your language",
        body: "Viral, karaoke, animated and emoji caption styles in English, Hindi, Spanish, French, German and Arabic.",
      },
    ],
    steps: [
      { title: "Upload or paste a link", body: "Upload an MP4 or paste a YouTube, Vimeo, Loom or Google Drive link." },
      { title: "Choose clips and captions", body: "Pick how many clips, their length, caption style and export quality." },
      { title: "Schedule or download", body: "Download your clips or schedule them to YouTube Shorts and Instagram Reels." },
    ],
    comparison: {
      competitor: "OpusClip",
      rows: [
        { feature: "AI picks the best moments", autoclipr: "Yes", competitor: "Yes" },
        { feature: "Auto captions", autoclipr: "Yes — 4 styles, 6 languages", competitor: "Yes" },
        { feature: "Vertical 9:16 export", autoclipr: "Yes, up to 4K", competitor: "Yes" },
        { feature: "Import from a link", autoclipr: "YouTube, Vimeo, Loom, Google Drive, MP4", competitor: "Yes" },
        { feature: "Schedule to Shorts & Reels", autoclipr: "Built-in content calendar (Creator & Business)", competitor: "Available on some plans" },
        { feature: "Free to start", autoclipr: "30 free credits, no card", competitor: "Free plan with limits" },
        { feature: "Pricing model", autoclipr: "Credits per clip, cost shown before you create", competitor: "Monthly plans with processing minutes" },
      ],
      note: COMPARISON_NOTE,
    },
    faq: [
      {
        q: "Is AutoClipr a good OpusClip alternative?",
        a: "If you want AI clipping plus a built-in scheduler for YouTube Shorts and Instagram Reels, yes. AutoClipr covers the full path from long video to published clip in one place.",
      },
      {
        q: "Is AutoClipr free?",
        a: "Every new account gets 30 free credits on the Starter plan with no credit card, enough to try the full pipeline on real videos before you upgrade.",
      },
      {
        q: "Can I move my workflow from OpusClip to AutoClipr?",
        a: "Yes. Paste the same YouTube links or upload the same files you used before and AutoClipr will clip them. There's nothing to migrate.",
      },
      {
        q: "Is AutoClipr affiliated with OpusClip?",
        a: "No. AutoClipr is an independent product. OpusClip is a trademark of its owner.",
      },
    ],
  },
  {
    slug: "vizard-alternative",
    title: "AutoClipr vs Vizard: The Vizard.ai Alternative",
    description:
      "Looking for a Vizard.ai alternative? Compare AutoClipr and Vizard on AI clipping, captions, scheduling and pricing. Turn long videos into short clips in minutes — start free with 30 credits.",
    keywords: [
      "Vizard alternative",
      "Vizard.ai alternative",
      "AutoClipr vs Vizard",
      "Vizard vs AutoClipr",
      "apps like Vizard",
      "Vizard free alternative",
      "AI clipping tool",
      "auto clip generator",
    ],
    h1: "A simpler Vizard alternative for short-form clips",
    subtitle:
      "Paste a link or upload a video and AutoClipr returns ready-to-post vertical clips with captions. Then schedule them to YouTube Shorts and Instagram Reels without leaving the app.",
    heroCta: "Try AutoClipr free",
    benefits: [
      {
        title: "Built for speed",
        body: "Set clip count, length and captions on one screen, see the processing time estimate, and get clips without a timeline editor.",
      },
      {
        title: "Know the cost upfront",
        body: "AutoClipr shows the credit cost before you create, so there are no surprises. New accounts start with 30 free credits.",
      },
      {
        title: "Publish on schedule",
        body: "Put clips on a calendar and AutoClipr posts them to Shorts and Reels, with retries and email alerts if something needs attention.",
      },
    ],
    steps: [
      { title: "Add your video", body: "Upload an MP4 or paste a YouTube, Vimeo, Loom or Google Drive link." },
      { title: "Set your options", body: "Choose clip count, length, caption style, language and quality." },
      { title: "Post your clips", body: "Download them or schedule them to YouTube Shorts and Instagram Reels." },
    ],
    comparison: {
      competitor: "Vizard",
      rows: [
        { feature: "AI picks the best moments", autoclipr: "Yes", competitor: "Yes" },
        { feature: "Auto captions", autoclipr: "Yes — 4 styles, 6 languages", competitor: "Yes" },
        { feature: "Vertical 9:16 export", autoclipr: "Yes, up to 4K", competitor: "Yes" },
        { feature: "Import from a link", autoclipr: "YouTube, Vimeo, Loom, Google Drive, MP4", competitor: "Yes" },
        { feature: "Schedule to Shorts & Reels", autoclipr: "Built-in content calendar (Creator & Business)", competitor: "Available on some plans" },
        { feature: "Free to start", autoclipr: "30 free credits, no card", competitor: "Free plan with limits" },
        { feature: "Pricing model", autoclipr: "Credits per clip, cost shown before you create", competitor: "Monthly plans with upload minutes" },
      ],
      note: COMPARISON_NOTE,
    },
    faq: [
      {
        q: "Is AutoClipr a good Vizard alternative?",
        a: "If you want fast AI clipping with captions and a built-in scheduler for YouTube Shorts and Instagram Reels, yes.",
      },
      {
        q: "Is AutoClipr free?",
        a: "Yes, to start. Every new account gets 30 free credits on the Starter plan, no credit card required.",
      },
      {
        q: "Which languages do captions support?",
        a: "English, Hindi, Spanish, French, German and Arabic, in viral, karaoke, animated and emoji styles.",
      },
      {
        q: "Is AutoClipr affiliated with Vizard?",
        a: "No. AutoClipr is an independent product. Vizard is a trademark of its owner.",
      },
    ],
  },
];

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
