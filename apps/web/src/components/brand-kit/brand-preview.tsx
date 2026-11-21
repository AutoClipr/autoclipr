"use client";

import { CAPTION_PRESETS, fontCss, fontWeightCss, type BrandCaptions, type BrandColors, type BrandLogo } from "@/lib/brand-kits";
import { cn } from "@/lib/utils";

const SAMPLE = ["This", "is", "how", "your", "captions", "will", "look"];

/**
 * A 9:16 mock frame showing the logo and caption styling. An approximation
 * for choosing settings — the renderer (libass + ffmpeg) produces the real
 * output with the same values.
 */
export function BrandPreview({
  captions,
  colors,
  logo,
  logoUrl,
  captionFont,
  className,
}: {
  captions: BrandCaptions;
  colors: BrandColors;
  logo: BrandLogo;
  logoUrl: string | null;
  captionFont?: string;
  className?: string;
}) {
  const preset = CAPTION_PRESETS.find((p) => p.id === captions.preset);
  const c = { ...(preset?.defaults ?? {}), ...captions };
  const font = c.font ?? captionFont;
  const words = SAMPLE.slice(0, Math.max(1, Math.min(c.max_words ?? 3, SAMPLE.length)));
  const activeIndex = Math.min(1, words.length - 1);
  // Preview is ~1/6 scale of the 1080-wide render.
  const fontPx = Math.round(((c.size ?? 72) / 1080) * 216);
  const outline = Math.round(((c.outline ?? 4) / 1080) * 216 * 2) / 2;
  const pos = c.position ?? "bottom";
  const align = c.alignment ?? "center";
  const logoPos = logo.position ?? "top-right";

  return (
    <div
      className={cn("relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 shadow-xl", className)}
      style={{ background: `linear-gradient(160deg, ${colors.secondary}, ${colors.background})` }}
      aria-label="Brand preview"
    >
      {/* Fake footage */}
      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(60% 40% at 50% 40%, ${colors.accent}55, transparent 70%)` }} />
      <div className="absolute left-1/2 top-[30%] h-[28%] w-[44%] -translate-x-1/2 rounded-full bg-white/10 blur-[1px]" />
      <div className="absolute left-1/2 top-[52%] h-[30%] w-[64%] -translate-x-1/2 rounded-t-[40%] bg-white/10" />

      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Logo"
          className={cn(
            "absolute h-auto object-contain",
            logoPos.startsWith("top") ? "top-[5%]" : "bottom-[12%]",
            logoPos.endsWith("left") ? "left-[4%]" : "right-[4%]",
          )}
          style={{ width: `${logo.size ?? 14}%`, opacity: logo.opacity ?? 0.9 }}
        />
      )}

      <div
        className={cn(
          "absolute inset-x-[7%] flex",
          pos === "top" ? "top-[14%]" : pos === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-[21%]",
          align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center",
        )}
      >
        <p
          className="leading-tight"
          style={{
            fontFamily: fontCss(font),
            fontWeight: fontWeightCss(font),
            fontSize: fontPx,
            textAlign: align,
            color: c.color ?? colors.text,
            WebkitTextStroke: outline ? `${outline}px #000` : undefined,
            paintOrder: "stroke fill",
            textShadow: c.shadow ? `0 ${c.shadow}px ${c.shadow * 2}px rgba(0,0,0,0.7)` : undefined,
            background: c.background ? `${c.background_color ?? "#000000"}cc` : undefined,
            padding: c.background ? "2px 6px" : undefined,
            borderRadius: c.background ? 6 : undefined,
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={i === activeIndex ? { color: c.highlight_color ?? colors.primary } : undefined}>
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
export function Swatches({ colors, className }: { colors: Partial<BrandColors>; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {(["primary", "secondary", "accent", "background", "text"] as const).map((k) =>
        colors[k] ? (
          <span key={k} title={k} className="h-4 w-4 rounded-full border border-white/20" style={{ background: colors[k] }} />
        ) : null,
      )}
    </span>
  );
}
