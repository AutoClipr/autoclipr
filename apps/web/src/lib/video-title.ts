/**
 * Real title for a video row. URL imports start with a placeholder title
 * ("YouTube import · 11/17/2026") that the worker replaces once it downloads;
 * if the import failed first, look the title up from the link instead.
 */
export async function resolveVideoTitle(v: { title: string; source_url?: string | null }): Promise<string> {
  if (!/ import · /.test(v.title) || !v.source_url) return v.title;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(v.source_url)}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return v.title;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || v.title;
  } catch {
    return v.title;
  }
}
