import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Film } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Clip, type Profile, type Video } from "@/lib/api";
import { ClipsList } from "@/components/dashboard/clips-list";
import { GenerateClipsButton } from "@/components/dashboard/generate-clips-button";
import { planLabel } from "@/lib/plans";
import { formatDuration } from "@/lib/utils";

export const metadata = { title: "Album" };

const NEW_FOR_MS = 48 * 60 * 60 * 1000;

/** One source video and every clip made from it. */
export default async function AlbumPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) notFound();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [videoRes, clipsRes, me] = await Promise.all([
    apiFetch<Video>(`/api/v1/videos/${videoId}`, { token }),
    apiFetch<Clip[]>(`/api/v1/clips?limit=24&video_id=${videoId}`, { token }),
    apiFetch<Profile>("/api/v1/users/me", { token }),
  ]);
  if (!videoRes.success || !videoRes.data) notFound();

  const video = videoRes.data;
  const clips = clipsRes.data ?? [];
  const total = clipsRes.meta?.total ?? clips.length;
  const isNew = Date.now() - new Date(video.created_at).getTime() < NEW_FOR_MS;

  return (
    <div className="space-y-6">
      <Link href="/clips" className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-[#F8FAFC]">
        <ArrowLeft className="h-4 w-4" /> All albums
      </Link>

      <header className="flex flex-col gap-5 rounded-2xl border border-[#253244] bg-[#101824] p-5 sm:flex-row sm:items-center">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-[#070B12] sm:w-60">
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film className="h-8 w-8 text-[#253244]" aria-hidden />
            </div>
          )}
          <span className="absolute right-2 top-2 flex gap-1.5">
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {planLabel(me.data?.subscription_tier)}
            </span>
            {isNew && <span className="rounded-full bg-[#54D045] px-2.5 py-1 text-[11px] font-semibold text-[#070B12]">New</span>}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">ALBUM</p>
          <h1 className="mt-1 line-clamp-2 text-xl font-bold tracking-tight text-[#F8FAFC] sm:text-2xl">{video.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-[#94A3B8]">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {video.duration_seconds ? formatDuration(video.duration_seconds) : "Length unknown"} · {total} clip{total === 1 ? "" : "s"} ·{" "}
            {new Date(video.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="sm:w-52">
          <GenerateClipsButton videoId={video.id} videoStatus={video.status} />
        </div>
      </header>

      {!clipsRes.success ? (
        <p className="rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/[0.05] px-4 py-3 text-sm text-[#F8FAFC]">
          We couldn&apos;t load this album&apos;s clips. Please refresh.
        </p>
      ) : clips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#253244] bg-[#101824] p-10 text-center text-sm text-[#94A3B8]">
          No clips in this album yet. Generate clips from this video to fill it.
        </div>
      ) : (
        <ClipsList clips={clips} total={total} videoId={video.id} />
      )}
    </div>
  );
}
