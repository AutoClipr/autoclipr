"use client";

import { useState } from "react";
import { Link2, Sparkles, Upload } from "lucide-react";
import { UploadForm } from "@/components/dashboard/upload-form";
import { CreateFromUrl } from "@/components/dashboard/create-from-url";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "url", label: "From URL", icon: Link2 },
  { id: "file", label: "Upload File", icon: Upload },
] as const;

export default function UploadPage() {
  const [tab, setTab] = useState<"url" | "file">("url");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#253244] bg-gradient-to-br from-[#101824] via-[#0B1220] to-[#070B12] px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-[#54D045]/[0.12] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-[#54D045]">
              <Sparkles className="h-3.5 w-3.5" /> AI VIDEO CREATION
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#F8FAFC] sm:text-[34px]">Create viral shorts.</h1>
            <p className="mt-1.5 max-w-xl text-sm text-[#94A3B8]">
              Turn any long video into engaging short-form content with AI.
            </p>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-[#64748B] sm:text-right">
            Paste a video URL or upload a file. AI handles analysis, clipping, captions, and export.
          </p>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Video source"
        className="flex gap-1 rounded-xl border border-[#253244] bg-[#0B1220] p-1"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-[#19251F] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(84,208,69,0.35)]"
                  : "text-[#94A3B8] hover:bg-white/[0.03] hover:text-[#F8FAFC]",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-[#54D045]")} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "url" ? <CreateFromUrl /> : <UploadForm />}
    </div>
  );
}
