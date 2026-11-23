/**
 * Brand kit types, option lists and API helpers. The API enforces plan
 * access, limits, ownership and validation; these lists only drive the UI and
 * must stay in step with apps/api/src/modules/brand-kits/brand-kit.constants.ts.
 */
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";

export type BrandColors = { primary: string; secondary: string; accent: string; background: string; text: string };
export type BrandCaptions = {
  preset?: CaptionPresetId;
  font?: string;
  size?: number;
  color?: string;
  highlight_color?: string;
  background_color?: string;
  background?: boolean;
  outline?: number;
  shadow?: number;
  position?: "top" | "middle" | "bottom";
  alignment?: "left" | "center" | "right";
  max_words?: number;
};
export type BrandTypography = {
  heading_font?: string;
  caption_font?: string;
  font_weight?: number;
  text_size?: "small" | "medium" | "large";
  alignment?: "left" | "center" | "right";
};
export type BrandLogo = { position?: LogoPosition; size?: number; opacity?: number };

export type BrandKit = {
  id: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  intro_path: string | null;
  outro_path: string | null;
  logo_url: string | null;
  intro_url: string | null;
  outro_url: string | null;
  intro_enabled: boolean;
  outro_enabled: boolean;
  colors: BrandColors;
  typography: BrandTypography;
  captions: BrandCaptions;
  logo: BrandLogo;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

/** Built-in templates have ids like "preset:bold-green". */
export const isPresetKit = (k: Pick<BrandKit, "id"> | null | undefined) => !!k?.id.startsWith("preset:");

export type BrandKitInput = Partial<
  Pick<
    BrandKit,
    "name" | "description" | "logo_path" | "intro_path" | "outro_path" | "intro_enabled" | "outro_enabled" | "typography" | "captions" | "logo"
  >
> & { colors?: Partial<BrandColors>; is_default?: boolean };

/* ─── Options (mirror the API constants) ───────────────────────────────── */

export const BRAND_FONTS = [
  "Montserrat",
  "Montserrat SemiBold",
  "Montserrat ExtraBold",
  "Montserrat Black",
  "DejaVu Sans",
  "DejaVu Serif",
  "EB Garamond",
  "Pacifico",
] as const;

/** CSS stack used for previews (the renderer uses the real installed font). */
export const fontCss = (f?: string) => {
  if (!f) return "Montserrat, Inter, sans-serif";
  if (f.startsWith("Montserrat")) return "Montserrat, Inter, sans-serif";
  if (f === "Pacifico") return "Pacifico, cursive";
  if (f === "EB Garamond" || f === "DejaVu Serif") return "'EB Garamond', Georgia, serif";
  return "'DejaVu Sans', Verdana, sans-serif";
};
export const fontWeightCss = (f?: string, w?: number) =>
  w ?? (f?.includes("Black") ? 900 : f?.includes("ExtraBold") ? 800 : f?.includes("SemiBold") ? 600 : 700);

export type CaptionPresetId =
  | "classic_white"
  | "bold_highlight"
  | "modern_minimal"
  | "word_highlight"
  | "creator_style"
  | "neon_highlight"
  | "karaoke_style"
  | "clean_subtitle";

/** Presets and the look they start from (users can override every value). */
export const CAPTION_PRESETS: { id: CaptionPresetId; label: string; defaults: BrandCaptions }[] = [
  { id: "classic_white", label: "Classic White", defaults: { color: "#FFFFFF", highlight_color: "#FFFFFF", outline: 3, shadow: 1, background: false, max_words: 5 } },
  { id: "bold_highlight", label: "Bold Highlight", defaults: { color: "#FFFFFF", highlight_color: "#FFE600", outline: 6, shadow: 2, background: false, max_words: 3 } },
  { id: "modern_minimal", label: "Modern Minimal", defaults: { color: "#FFFFFF", highlight_color: "#FFFFFF", outline: 0, shadow: 2, background: false, max_words: 5 } },
  { id: "word_highlight", label: "Word Highlight", defaults: { color: "#FFFFFF", highlight_color: "#54D045", outline: 4, shadow: 0, background: false, max_words: 3 } },
  { id: "creator_style", label: "Creator Style", defaults: { color: "#FFFFFF", highlight_color: "#FF3B6B", outline: 8, shadow: 3, background: false, max_words: 2 } },
  { id: "neon_highlight", label: "Neon Highlight", defaults: { color: "#FFFFFF", highlight_color: "#35D6E8", outline: 4, shadow: 4, background: false, max_words: 3 } },
  { id: "karaoke_style", label: "Karaoke Style", defaults: { color: "#FFFFFF", highlight_color: "#FFD400", outline: 5, shadow: 1, background: false, max_words: 4 } },
  { id: "clean_subtitle", label: "Clean Subtitle", defaults: { color: "#FFFFFF", highlight_color: "#FFFFFF", outline: 0, shadow: 0, background: true, background_color: "#000000", max_words: 6 } },
];

export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export const LOGO_POSITIONS: { id: LogoPosition; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
];

export const DEFAULT_COLORS: BrandColors = {
  primary: "#54D045",
  secondary: "#101828",
  accent: "#00D6A0",
  background: "#050817",
  text: "#FFFFFF",
};

export const ASSET_RULES = {
  logo: { accept: "image/png,image/jpeg", mimes: ["image/png", "image/jpeg"], maxMb: 5, label: "PNG or JPG, up to 5 MB" },
  intro: { accept: "video/mp4,video/quicktime,video/webm", mimes: ["video/mp4", "video/quicktime", "video/webm"], maxMb: 100, label: "MP4, MOV or WebM, up to 100 MB · first 15 s used" },
  outro: { accept: "video/mp4,video/quicktime,video/webm", mimes: ["video/mp4", "video/quicktime", "video/webm"], maxMb: 100, label: "MP4, MOV or WebM, up to 100 MB · last 15 s used" },
} as const;
export type AssetKind = keyof typeof ASSET_RULES;

/* ─── API ──────────────────────────────────────────────────────────────── */

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const res = await apiFetch<T>(`/api/v1/brand-kits${path}`, { ...init, token, skipGlobalLoader: true });
  if (!res.success) throw new Error(res.error?.message ?? "Something went wrong. Please try again.");
  return res.data as T;
}

export const brandKitsApi = {
  entitlement: () => call<{ allowed: boolean; max: number; planName: string }>("/entitlement"),
  list: () => call<{ items: BrandKit[]; limit: number; count: number }>(""),
  /** Built-in templates, shaped like kits for display. */
  presets: async (): Promise<BrandKit[]> => {
    const rows = await call<{ id: string; name: string; colors: BrandColors; captions: BrandCaptions }[]>("/presets");
    return rows.map((r) => ({
      id: r.id, name: r.name, description: null,
      logo_path: null, intro_path: null, outro_path: null, logo_url: null, intro_url: null, outro_url: null,
      intro_enabled: false, outro_enabled: false,
      colors: r.colors, typography: { caption_font: r.captions.font }, captions: r.captions, logo: {},
      is_default: false, created_at: "", updated_at: "",
    }));
  },
  create: (input: BrandKitInput) => call<BrandKit>("", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: BrandKitInput) => call<BrandKit>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => call<{ deleted: boolean }>(`/${id}`, { method: "DELETE" }),
  duplicate: (id: string) => call<BrandKit>(`/${id}/duplicate`, { method: "POST" }),
  setDefault: (id: string) => call<BrandKit>(`/${id}/set-default`, { method: "POST" }),

  /** Validate locally, get a signed URL, PUT the file. Resolves to the stored path. */
  async uploadAsset(kind: AssetKind, file: File, onProgress?: (pct: number) => void): Promise<string> {
    const rule = ASSET_RULES[kind];
    if (!(rule.mimes as readonly string[]).includes(file.type)) throw new Error(`Unsupported file. Use ${rule.label}.`);
    if (file.size > rule.maxMb * 1024 * 1024) throw new Error(`File is too large (max ${rule.maxMb} MB).`);
    if (kind === "logo") {
      const dims = await imageSize(file);
      if (!dims || dims.width < 64 || dims.height < 64) throw new Error("Logo must be at least 64 × 64 pixels.");
      if (dims.width > 4000 || dims.height > 4000) throw new Error("Logo must be at most 4000 × 4000 pixels.");
    }
    const { path, upload_url } = await call<{ path: string; upload_url: string }>("/assets", {
      method: "POST",
      body: JSON.stringify({ kind, mime_type: file.type, size: file.size }),
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress?.(Math.round((ev.loaded / ev.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Please try again.")));
      xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
      xhr.open("PUT", upload_url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
    return path;
  },
};

function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
