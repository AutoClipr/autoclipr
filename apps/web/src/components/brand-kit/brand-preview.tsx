"use client";

import { CAPTION_PRESETS, fontCss, fontWeightCss, type BrandCaptions, type BrandColors, type BrandLogo } from "@/lib/brand-kits";
import { cn } from "@/lib/utils";

const SAMPLE = ["This", "is", "how", "your", "captions", "will", "look"];

/** Sample "footage" behind the preview. Decorative only. */
export const PREVIEW_SCENES = {
  studio: { label: "Studio", css: (c: BrandColors) => `linear-gradient(160deg, ${c.secondary}, ${c.background})` },
  city: { label: "City night", css: () => "linear-gradient(180deg,#1b1035 0%,#3a1c4d 45%,#8a3b52 75%,#f08a4b 100%)" },
  daylight: { label: "Daylight", css: () => "linear-gradient(180deg,#9fd3ff 0%,#cfe9ff 55%,#e9d8b4 100%)" },
} as const;
export type PreviewScene = keyof typeof PREVIEW_SCENES;

/**
 * A 9:16 mock frame showing logo, brand name and caption styling. An
 * approximation for choosing settings — the renderer (libass + ffmpeg)
 * produces the real output from the same values.
 */
export function BrandPreview({
  captions,
  colors,
  logo,
  logoUrl,
  captionFont,
  headingFont,
  name,
  scene = "studio",
  activeWord,
  className,
}: {
  captions: BrandCaptions;
  colors: BrandColors;
  logo: BrandLogo;
  logoUrl: string | null;
  captionFont?: string;
  headingFont?: string;
  /** Brand name shown beside the logo (preview only). */
  name?: string;
  scene?: PreviewScene;
  /** Which sample word is highlighted (animates when playing). */
  activeWord?: number;
  className?: string;
}) {
  const preset = CAPTION_PRESETS.find((p) => p.id === captions.preset);
  const c = { ...(preset?.defaults ?? {}), ...captions };
  const font = c.font ?? captionFont;
  const words = SAMPLE.slice(0, Math.max(1, Math.min(c.max_words ?? 3, SAMPLE.length)));
  const active = (activeWord ?? 1) % words.length;
  const pos = c.position ?? "bottom";
  const align = c.alignment ?? "center";
  const logoPos = logo.position ?? "top-right";
  // Sizes as % of frame width so the preview scales with its container.
  const fontCqw = ((c.size ?? 72) / 1080) * 100;
  const outline = Math.max(0, Math.round(((c.outline ?? 4) / 1080) * 400) / 10);

  return (
    <div
      className={cn("relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 shadow-xl [container-type:inline-size]", className)}
      style={{ background: PREVIEW_SCENES[scene].css(colors) }}
      aria-label="Brand preview"
    >
      {/* Fake footage */}
      <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(60% 40% at 50% 40%, ${colors.accent}55, transparent 70%)` }} />
      <div className="absolute left-1/2 top-[30%] h-[28%] w-[44%] -translate-x-1/2 rounded-full bg-white/15 blur-[1px]" />
      <div className="absolute left-1/2 top-[52%] h-[34%] w-[66%] -translate-x-1/2 rounded-t-[40%] bg-white/15" />

      {(logoUrl || name?.trim()) && (
        <div
          className={cn(
            "absolute flex max-w-[88%] items-center gap-[3cqw]",
            logoPos.startsWith("top") ? "top-[5%]" : "bottom-[12%]",
            logoPos.endsWith("left") ? "left-[4%] flex-row" : "right-[4%] flex-row-reverse",
          )}
        >
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-auto shrink-0 object-contain" style={{ width: `${logo.size ?? 14}cqw`, opacity: logo.opacity ?? 0.9 }} />
          )}
          {name?.trim() && (
            <span
              className="truncate leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: fontCss(headingFont), fontWeight: fontWeightCss(headingFont), color: colors.text, fontSize: "5cqw" }}
            >
              {name.trim()}
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "absolute inset-x-[7%] flex",
          pos === "top" ? "top-[16%]" : pos === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-[20%]",
          align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center",
        )}
      >
        <p
          className="leading-tight"
          style={{
            fontFamily: fontCss(font),
            fontWeight: fontWeightCss(font),
            fontSize: `${fontCqw}cqw`,
            textAlign: align,
            color: c.color ?? colors.text,
            WebkitTextStroke: outline ? `${outline}cqw #000` : undefined,
            paintOrder: "stroke fill",
            textShadow: c.shadow ? `0 ${c.shadow * 0.4}cqw ${c.shadow * 0.8}cqw rgba(0,0,0,0.7)` : undefined,
            background: c.background ? `${c.background_color ?? "#000000"}cc` : undefined,
            padding: c.background ? "0.6cqw 2cqw" : undefined,
            borderRadius: c.background ? "1.5cqw" : undefined,
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              className="transition-colors duration-150 motion-reduce:transition-none"
              style={i === active ? { color: c.highlight_color ?? colors.primary } : undefined}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

/** Row of colour dots. */
export function Swatches({ colors, className, size = "h-4 w-4" }: { colors: Partial<BrandColors>; className?: string; size?: string }) {
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {(["primary", "secondary", "accent", "background", "text"] as const).map((k) =>
        colors[k] ? <span key={k} title={k} className={cn("rounded-full border border-white/20", size)} style={{ background: colors[k] }} /> : null,
      )}
    </span>
  );
}
