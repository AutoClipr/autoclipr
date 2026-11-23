import Link from "next/link";
import { Clapperboard, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { apiFetch, type Clip, type Profile, type Video } from "@/lib/api";
import { planLabel } from "@/lib/plans";
import { ClipsList } from "@/components/dashboard/clips-list";
import { ProcessingVideosPanel } from "@/components/dashboard/processing-videos-panel";
import { AlbumsGrid } from "@/components/dashboard/albums-grid";
import { ReloadButton } from "@/components/dashboard/reload-button";

export const metadata = { title: "Clips" };

const IN_PROGRESS_STATUSES = new Set(["importing", "uploading", "processing", "analyzing", "failed"]);

export default async function ClipsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session!.access_token;

  const [clipsRes, videosRes, me, statsRes] = await Promise.all([
    apiFetch<Clip[]>("/api/v1/clips?limit=24", { token }),
    apiFetch<Video[]>("/api/v1/videos?limit=24", { token }),
    apiFetch<Profile>("/api/v1/users/me", { token }),
    apiFetch<{ total: number; ready: number; processing: number }>("/api/v1/clips/stats", { token }),
  ]);

  const loadFailed = !clipsRes.success;
  const clips = clipsRes.data ?? [];
  const totalClips = clipsRes.meta?.total ?? clips.length;
  const allVideos = videosRes.data ?? [];
  const processingVideos = allVideos.filter((v) => IN_PROGRESS_STATUSES.has(v.status));

  // Real totals from the API (not just the clips this page happened to load).
  const stats = statsRes.data ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-[#253244] bg-gradient-to-br from-[#101824] via-[#0B1220] to-[#070B12] p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#54D045]/[0.12] blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F8FAFC] sm:text-3xl">My Clips</h1>
            <p className="mt-1 text-sm text-[#94A3B8]">Your AI-generated content workspace.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <dl className="flex divide-x divide-[#253244] rounded-xl border border-[#253244] bg-[#070B12]/60">
              <Stat label="Total clips" value={stats?.total ?? totalClips} />
              <Stat label="Ready" value={stats?.ready ?? null} accent />
              {/* Videos still being turned into clips (each becomes an album). */}
              <Stat label="Processing" value={processingVideos.length} />
            </dl>
            <ReloadButton hasProcessing={processingVideos.length > 0} />
            <Link href="/create" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#54D045] px-4 text-sm font-semibold text-[#050817] hover:bg-[#62dc53]">
              <Sparkles className="h-4 w-4" /> Create New Clips
            </Link>
          </div>
        </div>
      </header>

      {processingVideos.length > 0 && <ProcessingVideosPanel videos={processingVideos} />}

      <AlbumsGrid
        videos={allVideos}
        hasMore={!!videosRes.meta?.has_more}
        planLabel={planLabel(me.data?.subscription_tier)}
      />

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">All Clips</h2>
          <p className="mt-0.5 text-sm text-[#94A3B8]">Explore, manage, and download your AI-generated shorts.</p>
        </div>

        {loadFailed ? (
          <div className="flex flex-col items-center rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/[0.05] px-6 py-12 text-center">
            <p className="font-medium text-[#F8FAFC]">We couldn&apos;t load your clips</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Please try again in a moment.</p>
            <div className="mt-5">
              <ReloadButton />
            </div>
          </div>
        ) : clips.length === 0 ? (
          <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-[#253244] px-6 py-16 text-center">
            <div className="pointer-events-none absolute top-0 h-40 w-80 rounded-full bg-[#54D045]/[0.08] blur-3xl" aria-hidden />
            <span className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#54D045]/30 bg-[#54D045]/10">
              <Clapperboard className="h-6 w-6 text-[#8fe383]" />
            </span>
            <p className="relative text-lg font-semibold text-[#F8FAFC]">
              {processingVideos.length > 0 ? "Your clips are on the way" : "Your creative space starts here."}
            </p>
            <p className="relative mt-2 max-w-sm text-sm text-[#94A3B8]">
              {processingVideos.length > 0
                ? "Your videos are still processing. Finished clips will show up here automatically."
                : "Generate your first AI-powered short video and watch your content come to life."}
            </p>
            {processingVideos.length === 0 && (
              <Link
                href="/upload"
                className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#54D045] px-5 text-sm font-semibold text-[#070B12] shadow-[0_0_30px_-8px_rgba(84,208,69,0.7)] hover:bg-[#62dc53]"
              >
                <Sparkles className="h-4 w-4" /> Create Your First Clips
              </Link>
            )}
          </div>
        ) : (
          <ClipsList clips={clips} total={totalClips} />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className="px-4 py-2.5">
      <dt className="whitespace-nowrap text-[11px] text-[#94A3B8]">{label}</dt>
      <dd className={accent ? "text-lg font-semibold tabular-nums text-[#8fe383]" : "text-lg font-semibold tabular-nums text-[#F8FAFC]"}>
        {value ?? "—"}
      </dd>
    </div>
  );
}
