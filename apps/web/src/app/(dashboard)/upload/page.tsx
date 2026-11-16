"use client";

import { PageHero } from "@/components/dashboard/page-hero";
import { useState } from "react";
import { Upload, Link2 } from "lucide-react";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        label="Create"
        title="Create viral"
        highlight="shorts"
        description="Paste any video URL or upload a file — AI handles analysis, clips, captions, and export."
      />

      <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "bg-white text-black shadow-[0_0_20px_-6px_rgba(255,255,255,0.5)]"
                  : "text-white/55 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "url" ? <CreateFromUrl /> : <UploadForm />}
    </div>
  );
}
