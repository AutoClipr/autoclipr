"use client";

import { useCallback, useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Youtube,
  Clock,
  Video,
  Share2,
  Loader2,
  Sparkles,
  Zap,
  Cpu,
  Film,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, type Clip, type PlatformConnection, type Video as VideoType, type YoutubeChannel } from "@/lib/api";
import { setConnectedPlatforms } from "@/lib/platforms-storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/hooks/use-confirm";
import { formatPipelineError } from "@/lib/pipeline-errors";
import { cn } from "@/lib/utils";
import { ClipsList } from "@/components/dashboard/clips-list";
import { DashboardPlatformsPanel } from "@/components/dashboard/dashboard-platforms-panel";
import { ConnectedChannelRow } from "@/components/dashboard/connected-channel-row";

type DashboardViewProps = {
  initialChannels: YoutubeChannel[];
  initialClips: Clip[];
  initialVideos: VideoType[];
  initialPlatforms: PlatformConnection[];
  /** Total clips on the server (the list itself is only the newest page). */
  clipsTotal?: number;
  loadFailed?: boolean;
};

const TABS = [
  { id: "channels", label: "Channels" },
  { id: "platforms", label: "Platforms" },
  { id: "runs", label: "Agent Runs" },
  { id: "clips", label: "My Clips" },
] as const;

const RUN_ACTIVE = new Set(["importing", "uploading", "processing", "analyzing"]);
type RunFilter = "all" | "active" | "failed" | "completed";

export function DashboardView({
  initialChannels,
  initialClips,
  initialVideos,
  initialPlatforms,
  clipsTotal,
  loadFailed = false,
}: DashboardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activateRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [channels, setChannels] = useState(initialChannels);
  const [clips, setClips] = useState(initialClips);
  const [videos, setVideos] = useState(initialVideos);
  const [platformCount, setPlatformCount] = useState(initialPlatforms.length);
  const [activeTab, setActiveTabState] = useState(() => {
    const t = searchParams.get("tab");
    return t && TABS.some((x) => x.id === t) ? t : "channels";
  });
  // Keep the tab in the URL so refreshes and shared links land on it, without a navigation.
  const setActiveTab = (t: string) => {
    setActiveTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const [removingChannelId, setRemovingChannelId] = useState<string | null>(null);
  const [totalClips, setTotalClips] = useState(clipsTotal ?? initialClips.length);

  const activeRuns =
    videos.filter((v) => v.status === "uploading" || v.status === "processing").length +
    clips.filter((c) => c.status === "pending" || c.status === "processing").length;

  const refreshingRef = useRef(false);
  const refreshData = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setRefreshing(false);
      refreshingRef.current = false;
      return;
    }
    const token = session.access_token;

    const [chRes, clipsRes, videosRes] = await Promise.all([
      apiFetch<YoutubeChannel[]>("/api/v1/channels", { token }),
      apiFetch<Clip[]>("/api/v1/clips?limit=24", { token }),
      apiFetch<VideoType[]>("/api/v1/videos?limit=24", { token }),
    ]);

    if (chRes.success && chRes.data) setChannels(chRes.data);
    if (clipsRes.success && clipsRes.data) setClips(clipsRes.data);
    if (videosRes.success && videosRes.data) setVideos(videosRes.data);
    if (clipsRes.meta?.total != null) setTotalClips(clipsRes.meta.total);
    const ok = chRes.success && clipsRes.success && videosRes.success;
    setRefreshNote(ok ? "Dashboard updated" : "Some data couldn't be refreshed. Try again in a moment.");
    setTimeout(() => setRefreshNote(null), 3000);
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
    refreshingRef.current = false;
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    setPlatformCount(initialPlatforms.length);
    setConnectedPlatforms(initialPlatforms.map((p) => p.platform));
  }, [initialPlatforms]);

  // Activate subscription on payment success redirect (webhook fallback)
  useEffect(() => {
    const payment = searchParams.get("payment");
    const plan = searchParams.get("plan");
    if (payment !== "success" || !plan || activateRef.current) return;
    activateRef.current = true;

    async function activate() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        // Capture Dodo's transaction/subscription ID from URL if present
        const transactionId =
          searchParams.get("subscription_id") ??
          searchParams.get("payment_id") ??
          searchParams.get("transaction_id") ??
          "";
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/activate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ planId: plan, transactionId, billingPeriod: searchParams.get("billing") ?? "yearly" }),
        });
        // Remove query params and refresh to show updated plan
        router.replace("/dashboard");
        router.refresh();
      } catch {
        // silently fail — webhook will handle it
      }
    }
    activate();
  }, [searchParams, router]);

  useEffect(() => {
    const onChannelsUpdated = () => {
      refreshData();
    };
    window.addEventListener("autoclipr:channels-updated", onChannelsUpdated);
    return () => window.removeEventListener("autoclipr:channels-updated", onChannelsUpdated);
  }, [refreshData]);

  async function disconnectChannel(id: string) {
    const ch = channels.find((c) => c.id === id);
    const ok = await confirm({
      title: `Remove ${ch?.channel_name ?? "this channel"}?`,
      description: "It will be removed from your source channels. Videos you imported and clips you made from it stay in your library.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setRemovingChannelId(id);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await apiFetch(`/api/v1/channels/${id}`, {
      method: "DELETE",
      token: session.access_token,
    });
    await refreshData();
    setRemovingChannelId(null);
  }

  const isLoading = refreshing || isPending;
  const [runFilter, setRunFilter] = useState<RunFilter>("all");

  // Jobs come from the user's videos: each video is one processing run.
  const runs = videos.filter((v) => {
    if (runFilter === "active") return RUN_ACTIVE.has(v.status);
    if (runFilter === "failed") return v.status === "failed";
    if (runFilter === "completed") return v.status === "ready";
    return true;
  });

  return (
    <div className="space-y-5">
      {dialog}
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#253244] bg-gradient-to-br from-[#101824] via-[#0B1220] to-[#070B12] p-6 sm:p-7">
        <div className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-[#54D045]/[0.12] blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-64 w-64 rounded-full bg-[#35D6E8]/[0.06] blur-3xl" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at top left, black 25%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#54D045] shadow-[0_0_6px_2px_rgba(84,208,69,0.6)]" />
              DASHBOARD
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#F8FAFC] sm:text-4xl">Your command center.</h1>
            <p className="mt-1.5 max-w-lg text-sm text-[#94A3B8]">
              Monitor your channels, track AI-generated clips, and manage your content pipeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/create"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] shadow-[0_10px_30px_-12px_rgba(84,208,69,0.7)] transition-colors hover:bg-[#62dc53]"
            >
              <Sparkles className="h-4 w-4" />
              Create Viral Shorts
            </Link>
            {[
              { href: "/channels", label: "Channels", icon: <Plus className="h-4 w-4" /> },
              { href: "/setup/platforms?from=dashboard", label: "Platforms", icon: <Share2 className="h-4 w-4" /> },
              { href: "/subscription", label: "Upgrade", icon: <Zap className="h-4 w-4 text-[#54D045]" /> },
            ].map((b) => (
              <Link
                key={b.href}
                href={b.href}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#253244] bg-[#101824] px-3 text-sm font-medium text-[#F8FAFC] transition-colors hover:border-[#35445a]"
              >
                {b.icon}
                {b.label}
              </Link>
            ))}
            <button
              onClick={refreshData}
              disabled={isLoading}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#253244] bg-[#101824] text-[#cbd5e1] transition-colors hover:border-[#35445a] hover:text-white disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>

      {(loadFailed || refreshNote) && (
        <p
          role="status"
          className={cn(
            "rounded-xl border px-4 py-2.5 text-sm",
            refreshNote === "Dashboard updated"
              ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]"
              : "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-100",
          )}
        >
          {refreshNote ?? "Some dashboard data couldn't be loaded. Use refresh to try again."}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Youtube className="h-5 w-5 text-[#FF4d4d]" />} accent="#FF0000" value={channels.length} label="Source channels" hint={channels.length === 0 ? "Add a channel you clip from" : "Saved clip sources"} />
        <StatCard icon={<Share2 className="h-5 w-5 text-[#54D045]" />} accent="#54D045" value={platformCount} label="Platforms connected" hint={platformCount === 0 ? "Connect to start posting" : "Where you publish"} />
        <StatCard icon={<Clock className="h-5 w-5 text-[#F59E0B]" />} accent="#F59E0B" value={activeRuns} label="Active runs" hint={activeRuns > 0 ? "Processing now" : "All caught up"} live={activeRuns > 0} />
        <StatCard icon={<Film className="h-5 w-5 text-[#35D6E8]" />} accent="#35D6E8" value={totalClips} label="Clips generated" hint={totalClips === 0 ? "Create your first clips" : "In your library"} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex h-auto w-full gap-1 overflow-x-auto rounded-xl border border-[#253244] bg-[#0B1220] p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className={TAB_TRIGGER}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Channels tab */}
        <TabsContent value="channels">
          <TabPanel
            title="Connected channels"
            description="The YouTube channels you use as sources for AI clipping."
            onRefresh={refreshData}
            refreshing={isLoading}
            action={
              <Link href="/channels" className="text-xs font-medium text-[#8fe383] hover:underline">
                Manage channels →
              </Link>
            }
          >
            {channels.length === 0 ? (
              <EmptyState
                icon={<Youtube className="h-7 w-7 text-[#FF4d4d]" />}
                title="No source channels yet"
                description="Add a YouTube channel you clip from so it's one click away."
                action={<PrimaryLink href="/channels">Add a channel</PrimaryLink>}
              />
            ) : (
              <ul className="space-y-2">
                {channels.map((ch) => (
                  <li key={ch.id}>
                    <ConnectedChannelRow channel={ch} onRemove={disconnectChannel} removing={removingChannelId === ch.id} />
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        </TabsContent>

        {/* Platforms tab */}
        <TabsContent value="platforms">
          <TabPanel
            title="Connected platforms"
            description="The social accounts where AutoClipr can publish your clips."
            onRefresh={refreshData}
            refreshing={isLoading}
          >
            <DashboardPlatformsPanel initialPlatforms={initialPlatforms} refreshKey={refreshKey} onCountChange={setPlatformCount} />
          </TabPanel>
        </TabsContent>

        {/* Agent Runs tab */}
        <TabsContent value="runs">
          <TabPanel
            title="Agent runs"
            description="Your AI video processing jobs."
            onRefresh={refreshData}
            refreshing={isLoading}
          >
            {videos.length === 0 ? (
              <EmptyState
                icon={<Cpu className="h-7 w-7 text-[#94A3B8]" />}
                title="No runs yet"
                description="When AutoClipr processes videos or generates clips, your jobs will appear here."
                action={<PrimaryLink href="/create">Create Viral Shorts</PrimaryLink>}
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter runs">
                  {(
                    [
                      ["all", "All"],
                      ["active", "Processing"],
                      ["completed", "Completed"],
                      ["failed", "Failed"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={runFilter === id}
                      onClick={() => setRunFilter(id)}
                      className={cn(
                        "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                        runFilter === id
                          ? "bg-[#19251F] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(84,208,69,0.4)]"
                          : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#F8FAFC]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {runs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#94A3B8]">
                    {runFilter === "active" ? "Nothing is processing right now." : "No runs match this filter."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {runs.map((v) => (
                      <RunRow key={v.id} video={v} />
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-[#64748B]">Showing your latest {videos.length} videos.</p>
              </>
            )}
          </TabPanel>
        </TabsContent>

        {/* My Clips tab */}
        <TabsContent value="clips">
          <TabPanel
            title="My clips"
            description="Your AI-generated shorts, ready to review, download, and publish."
            onRefresh={refreshData}
            refreshing={isLoading}
            action={
              <Link href="/clips" className="text-xs font-medium text-[#8fe383] hover:underline">
                Open My Clips →
              </Link>
            }
          >
            {clips.length === 0 ? (
              <EmptyState
                icon={<Video className="h-7 w-7 text-[#94A3B8]" />}
                title="No clips yet"
                description="Paste a video link or upload a file to generate your first clips."
                action={<PrimaryLink href="/create">Create Viral Shorts</PrimaryLink>}
              />
            ) : (
              <>
                <p className="mb-4 rounded-xl border border-[#253244] bg-[#0A111B] px-4 py-2.5 text-xs text-[#94A3B8]">
                  Clips aren&apos;t posted automatically. Use <span className="font-semibold text-[#F8FAFC]">Post</span> on a clip, or schedule it in the Content Scheduler.
                </p>
                <ClipsList clips={clips} total={totalClips} />
              </>
            )}
          </TabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const TAB_TRIGGER =
  "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:text-[#F8FAFC] data-[state=active]:bg-[#19251F] data-[state=active]:text-[#F8FAFC] data-[state=active]:shadow-[inset_0_0_0_1px_rgba(84,208,69,0.4)]";

function StatCard({
  icon,
  accent,
  value,
  label,
  hint,
  live = false,
}: {
  icon: React.ReactNode;
  accent: string;
  value: number;
  label: string;
  hint: string;
  live?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#253244] bg-[#101824] p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${accent}aa, transparent)` }} aria-hidden />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#253244] bg-[#0A111B]">{icon}</span>
        {live && (
          <span className="flex items-center gap-1 rounded-md bg-[#F59E0B]/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" /> LIVE
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[#F8FAFC]">{value.toLocaleString()}</p>
      <p className="text-sm font-medium text-[#cbd5e1]">{label}</p>
      <p className="mt-0.5 truncate text-xs text-[#64748B]">{hint}</p>
    </div>
  );
}

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  importing: { label: "Importing", cls: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]" },
  uploading: { label: "Uploading", cls: "border-[#35D6E8]/30 bg-[#35D6E8]/10 text-[#9beef7]" },
  processing: { label: "Processing", cls: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-200" },
  analyzing: { label: "Analyzing", cls: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-200" },
  ready: { label: "Completed", cls: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86efac]" },
  failed: { label: "Failed", cls: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#fca5a5]" },
};

function RunRow({ video }: { video: VideoType }) {
  const st = RUN_STATUS[video.status] ?? { label: video.status, cls: "border-[#253244] bg-[#131D2B] text-[#94A3B8]" };
  const active = RUN_ACTIVE.has(video.status);
  const err = (video as VideoType & { error_message?: string | null }).error_message;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[#253244] bg-[#0B1220] p-3">
      <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-[#0A111B]">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Film className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-[#475569]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#F8FAFC]">{video.title}</p>
        <p className="text-xs text-[#64748B]">
          {video.source_type === "upload" ? "Upload" : "Link import"} ·{" "}
          {new Date(video.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
        {video.status === "failed" && err && (
          <p className="mt-0.5 line-clamp-1 flex items-center gap-1 text-xs text-[#fca5a5]">
            <AlertTriangle className="h-3 w-3 shrink-0" /> {formatPipelineError(err)}
          </p>
        )}
      </div>
      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>
        {active ? <Loader2 className="h-3 w-3 animate-spin" /> : video.status === "ready" ? <CheckCircle2 className="h-3 w-3" /> : null}
        {st.label}
      </span>
      {video.status === "ready" && (
        <Link href={`/clips?video=${video.id}`} className="hidden shrink-0 items-center gap-1 text-xs font-medium text-[#8fe383] hover:underline sm:inline-flex">
          Clips <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}

function TabPanel({
  title,
  description,
  children,
  onRefresh,
  refreshing,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#253244] bg-[#101824]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#253244] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-[#94A3B8]">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {action}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[#94A3B8] hover:bg-white/[0.04] hover:text-white disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center rounded-lg bg-[#54D045] px-4 text-sm font-semibold text-[#070B12] hover:bg-[#62dc53]">
      {children}
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#253244] bg-[#0A111B]">{icon}</span>
      <p className="font-semibold text-[#F8FAFC]">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-[#94A3B8]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
