"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  List,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth-token";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  SCHEDULER_PLATFORMS,
  dayKey,
  formatDateTime,
  formatTime,
  statusStyle,
  utcToZoned,
  viewerTimeZone,
  zonedToUtcIso,
  type ScheduledPost,
} from "@/lib/scheduler";
import { PlatformIcon, ScheduleComposer } from "./schedule-composer";

type View = "month" | "week" | "list";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_IN_CELL = 2;

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function SchedulerView() {
  const tz = viewerTimeZone();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [posts, setPosts] = useState<ScheduledPost[] | null>(null);
  const [platform, setPlatform] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [composer, setComposer] = useState<{ date?: string | null; upload?: boolean; editing?: ScheduledPost | null } | null>(null);
  const [detail, setDetail] = useState<ScheduledPost | null>(null);
  const [dayList, setDayList] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Visible date range for the current view.
  const range = useMemo(() => {
    if (view === "week") {
      const s = startOfWeek(cursor);
      return { start: s, end: addDays(s, 7) };
    }
    if (view === "list") {
      const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      return { start: s, end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = startOfWeek(first);
    return { start: s, end: addDays(s, 42) };
  }, [view, cursor]);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const qs = new URLSearchParams({ startDate: range.start.toISOString(), endDate: range.end.toISOString() });
    if (platform) qs.set("platform", platform);
    if (status) qs.set("status", status);
    const [ranged, drafts] = await Promise.all([
      apiFetch<ScheduledPost[]>(`/api/v1/scheduled-posts/calendar?${qs}`, { token }),
      // Drafts have no date, so they never fall inside a range.
      !status || status === "draft"
        ? apiFetch<ScheduledPost[]>(`/api/v1/scheduled-posts?status=draft${platform ? `&platform=${platform}` : ""}`, { token })
        : Promise.resolve({ success: true, data: [] as ScheduledPost[] }),
    ]);
    const all = [...(ranged.data ?? []), ...((drafts.data ?? []).filter((d) => !d.scheduled_at))];
    setPosts(all);
    setDetail((d) => (d ? all.find((p) => p.id === d.id) ?? null : d));
  }, [range, platform, status]);

  useEffect(() => {
    setPosts(null);
    load();
  }, [load]);

  // Refresh while something is publishing so status updates appear.
  useEffect(() => {
    if (!posts?.some((p) => ["publishing", "scheduled"].includes(p.status))) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [posts, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const p of posts ?? []) {
      if (!p.scheduled_at) continue;
      const key = utcToZoned(p.scheduled_at, tz).date;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts, tz]);

  const drafts = (posts ?? []).filter((p) => !p.scheduled_at);
  const todayKey = dayKey(new Date());

  function shift(dir: number) {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    setCursor(d);
  }

  /** Drag a scheduled post onto another day, keeping its time of day. */
  async function moveTo(postId: string, toDay: string) {
    const post = posts?.find((p) => p.id === postId);
    if (!post?.scheduled_at || post.status !== "scheduled") {
      setToast("Only scheduled posts can be moved.");
      return;
    }
    const zone = post.timezone || tz;
    const { date, time } = utcToZoned(post.scheduled_at, zone);
    if (date === toDay) return;
    const token = await getAccessToken();
    if (!token) return;
    const res = await apiFetch(`/api/v1/scheduled-posts/${postId}/reschedule`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ scheduled_at: zonedToUtcIso(toDay, time, zone), timezone: zone }),
    });
    setToast(res.success ? "Post rescheduled" : res.error?.message ?? "Could not move the post");
    load();
  }

  const title =
    view === "week"
      ? `${range.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(range.start, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="relative mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Content Calendar</h1>
          <p className="mt-1 text-sm text-white/50">Plan and auto-publish your Shorts and Reels.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setComposer({ upload: true })}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/85 hover:bg-white/[0.08]"
          >
            <Upload className="h-4 w-4" /> Upload local video
          </button>
          <button
            type="button"
            onClick={() => setComposer({})}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_0_20px_-4px_rgba(255,255,255,0.55)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Schedule post
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous" onClick={() => shift(-1)} className={navBtn}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next" onClick={() => shift(1)} className={navBtn}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="ml-1 min-w-[10rem] text-base font-semibold text-white">{title}</p>
          <button type="button" onClick={() => setCursor(new Date())} className="ml-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20">
            Today
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectCls} aria-label="Filter by account">
            <option value="" className="bg-zinc-900">All accounts</option>
            {SCHEDULER_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900">{p.short}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Filter by status">
            <option value="" className="bg-zinc-900">All statuses</option>
            {["draft", "scheduled", "publishing", "published", "partially_published", "failed"].map((s) => (
              <option key={s} value={s} className="bg-zinc-900">{statusStyle(s).label}</option>
            ))}
          </select>
          <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5">
            {(["month", "week", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs capitalize", view === v ? "bg-white font-semibold text-black" : "text-white/60 hover:text-white")}
              >
                {v === "list" ? <List className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-1.5 backdrop-blur">
        {posts === null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/30">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        )}

        {/* Month */}
        {view === "month" && (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-1 pb-1">
                {WEEKDAYS.map((d) => (
                  <p key={d} className="py-2 text-center text-xs font-medium text-white/45">{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 42 }, (_, i) => {
                  const d = addDays(range.start, i);
                  const key = dayKey(d);
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const items = byDay.get(key) ?? [];
                  const past = key < todayKey;
                  return (
                    <div
                      key={key}
                      onDragOver={(e) => !past && e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        if (id && !past) moveTo(id, key);
                      }}
                      onClick={() => !past && setComposer({ date: key })}
                      className={cn(
                        "group min-h-[6.5rem] rounded-xl border p-1.5 text-left transition-colors",
                        inMonth ? "border-white/[0.06] bg-white/[0.03]" : "border-transparent bg-white/[0.01]",
                        past ? "cursor-default" : "cursor-pointer hover:border-white/15",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs",
                            key === todayKey ? "bg-emerald-400 font-bold text-black" : inMonth ? "text-white/75" : "text-white/25",
                          )}
                        >
                          {d.getDate()}
                        </span>
                        {!past && <Plus className="h-3.5 w-3.5 text-white/0 transition-colors group-hover:text-white/40" />}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, MAX_IN_CELL).map((p) => (
                          <PostChip key={p.id} post={p} tz={tz} onOpen={() => setDetail(p)} />
                        ))}
                        {items.length > MAX_IN_CELL && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDayList(key);
                            }}
                            className="w-full rounded-md px-1 text-left text-[11px] text-white/55 hover:text-white"
                          >
                            +{items.length - MAX_IN_CELL} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Week */}
        {view === "week" && (
          <div className="grid gap-1 md:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(range.start, i);
              const key = dayKey(d);
              const items = byDay.get(key) ?? [];
              const past = key < todayKey;
              return (
                <div
                  key={key}
                  onDragOver={(e) => !past && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id && !past) moveTo(id, key);
                  }}
                  className="min-h-[10rem] rounded-xl border border-white/[0.06] bg-white/[0.03] p-2"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className={cn("text-xs font-medium", key === todayKey ? "text-emerald-300" : "text-white/60")}>
                      {WEEKDAYS[d.getDay()]} {d.getDate()}
                    </p>
                    {!past && (
                      <button type="button" aria-label={`Schedule on ${key}`} onClick={() => setComposer({ date: key })} className="text-white/35 hover:text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((p) => (
                      <PostChip key={p.id} post={p} tz={tz} onOpen={() => setDetail(p)} large />
                    ))}
                    {!items.length && <p className="text-[11px] text-white/25">Nothing scheduled</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List */}
        {view === "list" && (
          <div className="divide-y divide-white/[0.06]">
            {(posts ?? [])
              .filter((p) => p.scheduled_at)
              .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
              .map((p) => (
                <PostRow key={p.id} post={p} tz={tz} onOpen={() => setDetail(p)} />
              ))}
            {posts && !posts.some((p) => p.scheduled_at) && (
              <p className="py-16 text-center text-sm text-white/45">Nothing scheduled this month.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-2 pb-1 pt-3 text-xs text-white/45">
          <span>Times shown in {tz}. Drag a scheduled post to move it.</span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-300">
            {(posts ?? []).filter((p) => p.status === "scheduled").length} scheduled
          </span>
        </div>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-2 text-sm font-semibold text-white">Drafts</p>
          <div className="divide-y divide-white/[0.06]">
            {drafts.map((p) => (
              <PostRow key={p.id} post={p} tz={tz} onOpen={() => setDetail(p)} />
            ))}
          </div>
        </div>
      )}

      <ScheduleComposer
        open={!!composer}
        onClose={() => setComposer(null)}
        onSaved={() => {
          setToast(composer?.editing ? "Post updated" : "Post saved");
          load();
        }}
        initialDate={composer?.date}
        startWithUpload={composer?.upload}
        editing={composer?.editing}
      />

      {dayList && (
        <Overlay onClose={() => setDayList(null)} title={new Date(`${dayList}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
          <div className="divide-y divide-white/[0.06]">
            {(byDay.get(dayList) ?? []).map((p) => (
              <PostRow
                key={p.id}
                post={p}
                tz={tz}
                onOpen={() => {
                  setDayList(null);
                  setDetail(p);
                }}
              />
            ))}
          </div>
        </Overlay>
      )}

      {detail && (
        <PostDetail
          post={detail}
          tz={tz}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setComposer({ editing: detail });
            setDetail(null);
          }}
          onChanged={(msg) => {
            setToast(msg);
            load();
          }}
          onDeleted={() => {
            setDetail(null);
            setToast("Post deleted");
            load();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

const navBtn = "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.1]";
const selectCls = "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 outline-none [color-scheme:dark]";

function Thumb({ post, className }: { post: ScheduledPost; className?: string }) {
  return post.media_thumbnail_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.media_thumbnail_url} alt="" className={cn("rounded-md bg-black object-cover", className)} />
  ) : (
    <span className={cn("flex items-center justify-center rounded-md bg-black/60", className)}>
      <Film className="h-3 w-3 text-white/40" />
    </span>
  );
}

function PostChip({ post, tz, onOpen, large }: { post: ScheduledPost; tz: string; onOpen: () => void; large?: boolean }) {
  const st = statusStyle(post.status);
  return (
    <button
      type="button"
      draggable={post.status === "scheduled"}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn("flex w-full items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left", st.chip)}
      title={`${st.label} · ${post.caption || "No caption"}`}
    >
      <Thumb post={post} className={large ? "h-10 w-7 shrink-0" : "h-6 w-4 shrink-0"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[10px] font-semibold">
          {post.scheduled_at && formatTime(post.scheduled_at, tz)}
          {post.scheduled_post_targets.map((t) => (
            <PlatformIcon key={t.id} platform={t.platform} className="h-2.5 w-2.5" />
          ))}
        </span>
        {large && <span className="line-clamp-2 text-[11px] text-white/80">{post.caption || "No caption"}</span>}
      </span>
    </button>
  );
}

function PostRow({ post, tz, onOpen }: { post: ScheduledPost; tz: string; onOpen: () => void }) {
  const st = statusStyle(post.status);
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-white/[0.02]">
      <Thumb post={post} className="h-14 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white/90">{post.caption || post.title || "No caption"}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
          {post.scheduled_at ? formatDateTime(post.scheduled_at, tz) : "No date yet"}
          {post.scheduled_post_targets.map((t) => (
            <PlatformIcon key={t.id} platform={t.platform} className="h-3 w-3" />
          ))}
        </p>
      </div>
      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", st.chip)}>{st.label}</span>
    </button>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0f14] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function PostDetail({
  post,
  tz,
  onClose,
  onEdit,
  onChanged,
  onDeleted,
}: {
  post: ScheduledPost;
  tz: string;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (msg: string) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const st = statusStyle(post.status);
  const editable = ["draft", "scheduled"].includes(post.status);
  const hasFailed = post.scheduled_post_targets.some((t) => t.status === "failed");

  async function act(kind: "publish" | "retry" | "delete", platform?: string) {
    setBusy(kind + (platform ?? ""));
    setError(null);
    const token = await getAccessToken();
    if (!token) return;
    const res =
      kind === "delete"
        ? await apiFetch(`/api/v1/scheduled-posts/${post.id}`, { method: "DELETE", token })
        : await apiFetch(`/api/v1/scheduled-posts/${post.id}/${kind === "publish" ? "publish-now" : "retry"}`, {
            method: "POST",
            token,
            body: JSON.stringify(platform ? { platform } : {}),
          });
    setBusy(null);
    if (!res.success) return setError(res.error?.message ?? "Something went wrong.");
    if (kind === "delete") return onDeleted();
    onChanged(kind === "publish" ? "Publishing within a minute" : "Retry queued");
  }

  return (
    <Overlay title="Post details" onClose={onClose}>
      <div className="flex gap-4">
        <Thumb post={post} className="h-36 w-20 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium", st.chip)}>{st.label}</span>
          {post.title && <p className="font-semibold text-white">{post.title}</p>}
          <p className="whitespace-pre-line text-white/80">{post.caption || "No caption"}</p>
          {post.hashtags && <p className="text-sky-300/80">{post.hashtags}</p>}
          <p className="text-xs text-white/45">
            {post.scheduled_at
              ? `${formatDateTime(post.scheduled_at, post.timezone || tz)} (${post.timezone || tz})`
              : "Draft — no date yet"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {post.scheduled_post_targets.map((t) => {
          const ts = statusStyle(t.status);
          return (
            <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={t.platform} className="h-4 w-4" />
                <span className="flex-1 text-sm text-white/85">{SCHEDULER_PLATFORMS.find((p) => p.id === t.platform)?.label ?? t.platform}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", ts.chip)}>{ts.label}</span>
                {t.platform_post_url && (
                  <a href={t.platform_post_url} target="_blank" rel="noopener noreferrer" aria-label="Open post" className="text-white/50 hover:text-white">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {t.status === "failed" && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => act("retry", t.platform)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/[0.08]"
                  >
                    {busy === `retry${t.platform}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Retry
                  </button>
                )}
              </div>
              {t.error_message && <p className="mt-1 text-xs text-rose-300/90">{t.error_message}</p>}
            </div>
          );
        })}
        {!post.scheduled_post_targets.length && <p className="text-xs text-white/45">No accounts selected yet.</p>}
      </div>

      {["published", "partially_published"].includes(post.status) && (
        <p className="mt-3 text-xs text-white/40">Published posts can only be edited or removed on the platform itself.</p>
      )}

      {error && <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-200">{error}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {confirmDelete ? (
          <>
            <span className="mr-auto self-center text-xs text-white/60">Delete this post from the calendar?</span>
            <button type="button" onClick={() => setConfirmDelete(false)} className={ghostBtn}>Keep</button>
            <button type="button" disabled={!!busy} onClick={() => act("delete")} className={cn(ghostBtn, "border-rose-500/40 text-rose-300 hover:bg-rose-500/10")}>
              {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </button>
          </>
        ) : (
          <>
            {post.status !== "publishing" && (
              <button type="button" onClick={() => setConfirmDelete(true)} className={cn(ghostBtn, "mr-auto text-rose-300")}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            {editable && (
              <button type="button" onClick={onEdit} className={ghostBtn}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {hasFailed && (
              <button type="button" disabled={!!busy} onClick={() => act("retry")} className={ghostBtn}>
                <RotateCcw className="h-4 w-4" /> Retry failed
              </button>
            )}
            {editable && post.scheduled_post_targets.length > 0 && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act("publish")}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish now
              </button>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}

const ghostBtn = "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]";
