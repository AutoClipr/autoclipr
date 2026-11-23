/** Content Scheduler: shared types and date/timezone helpers. */

export type SchedulerPlatform = "youtube" | "instagram";

export type ScheduledTarget = {
  id: string;
  platform: SchedulerPlatform;
  caption_override: string | null;
  status: string;
  platform_post_id: string | null;
  platform_post_url: string | null;
  error_message: string | null;
  retry_count: number;
  published_at: string | null;
};

export type ScheduledPost = {
  id: string;
  clip_id: string | null;
  media_storage_path: string;
  media_thumbnail_url: string | null;
  /** Signed video link when there's no thumbnail (uploaded media); the UI shows its first frame. */
  media_preview_url?: string | null;
  media_duration_seconds: number | null;
  title: string | null;
  caption: string;
  description: string | null;
  hashtags: string | null;
  scheduled_at: string | null;
  timezone: string;
  status: string;
  published_at: string | null;
  created_at: string;
  scheduled_post_targets: ScheduledTarget[];
};

/** Platforms the worker can publish to today. */
export const SCHEDULER_PLATFORMS: { id: SchedulerPlatform; label: string; short: string }[] = [
  { id: "youtube", label: "YouTube Shorts", short: "YouTube" },
  { id: "instagram", label: "Instagram Reels", short: "Instagram" },
];

export const STATUS_STYLES: Record<string, { label: string; chip: string; dot: string }> = {
  draft: { label: "Draft", chip: "border-white/15 bg-white/[0.06] text-white/70", dot: "bg-white/50" },
  scheduled: { label: "Scheduled", chip: "border-sky-400/30 bg-sky-500/15 text-sky-200", dot: "bg-sky-400" },
  publishing: { label: "Publishing", chip: "border-amber-400/30 bg-amber-500/15 text-amber-200", dot: "bg-amber-400" },
  queued: { label: "Queued", chip: "border-amber-400/30 bg-amber-500/15 text-amber-200", dot: "bg-amber-400" },
  retrying: { label: "Retrying", chip: "border-amber-400/30 bg-amber-500/15 text-amber-200", dot: "bg-amber-400" },
  published: { label: "Published", chip: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200", dot: "bg-emerald-400" },
  partially_published: { label: "Partly published", chip: "border-lime-400/30 bg-lime-500/15 text-lime-200", dot: "bg-lime-400" },
  failed: { label: "Failed", chip: "border-rose-400/30 bg-rose-500/15 text-rose-200", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", chip: "border-white/10 bg-white/[0.04] text-white/45", dot: "bg-white/30" },
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.draft;
}

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** A few common zones, plus whatever the viewer is in. */
export function timeZoneOptions(current: string): string[] {
  const common = [
    "UTC",
    "Asia/Kolkata",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  return [...new Set([current, ...common])];
}

/** Milliseconds the zone is ahead of UTC at `utcMs`. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/**
 * "2026-11-20" + "18:30" in "Asia/Kolkata" → UTC ISO string. Re-checks the
 * offset at the result so a time near a daylight-saving change lands right.
 */
export function zonedToUtcIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - zoneOffsetMs(guess, timeZone);
  const second = zoneOffsetMs(utc, timeZone);
  utc = guess - second;
  return new Date(utc).toISOString();
}

/** UTC ISO → { date: "YYYY-MM-DD", time: "HH:MM" } as seen in `timeZone`. */
export function utcToZoned(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Local calendar-day key "YYYY-MM-DD" for a Date built from local parts. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Plans that include the Content Scheduler (matches the API and worker). */
export const SCHEDULER_PLANS = ["creator", "pro", "business"];

export function hasSchedulerAccess(tier?: string | null): boolean {
  return SCHEDULER_PLANS.includes(tier ?? "");
}
