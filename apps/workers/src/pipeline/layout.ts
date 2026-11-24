/**
 * Output frame + layout → ffmpeg video filter. Pure (unit-tested).
 *
 * fill: scale to cover the frame and crop the overflow (no borders).
 * fit:  crop the source to the chosen content ratio (original/4:3/1:1) at the
 *       chosen anchor, scale it to fit inside the frame without distortion,
 *       and fill the rest with a blurred copy, black or a solid colour.
 */

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';
export type LayoutMode = 'fill' | 'fit';
export type CropRatio = 'original' | '4:3' | '1:1';
export type Background = 'blur' | 'black' | 'color';
export type Anchor = 'center' | 'top' | 'bottom';

export type LayoutConfig = {
  aspect_ratio?: AspectRatio;
  layout?: LayoutMode;
  crop_ratio?: CropRatio;
  background?: Background;
  background_color?: string;
  position?: Anchor;
};

/** Long edge per quality; the short edge follows the ratio (even numbers). */
const LONG_EDGE: Record<string, number> = { hd: 1920, full_hd: 1920, '4k': 3840 };

export function outputSize(ratio: AspectRatio | undefined, quality = 'hd'): [number, number] {
  const L = LONG_EDGE[quality] ?? 1920;
  const even = (n: number) => Math.round(n / 2) * 2;
  switch (ratio) {
    case '16:9':
      return [L, even((L * 9) / 16)];
    case '1:1':
      return [even((L * 9) / 16), even((L * 9) / 16)];
    case '4:5':
      return [even((L * 9) / 16), even((L * 9 * 5) / (16 * 4))];
    case '9:16':
    default:
      return [even((L * 9) / 16), L];
  }
}

const anchorY = (a: Anchor | undefined) => (a === 'top' ? '0' : a === 'bottom' ? '(ih-oh)' : '(ih-oh)/2');

/** Crop the source to a content ratio (w/h) around the anchor; no-op for original. */
function contentCrop(crop: CropRatio | undefined, anchor: Anchor | undefined): string | null {
  if (!crop || crop === 'original') return null;
  const r = crop === '4:3' ? '4/3' : '1';
  // Largest window of ratio r inside the source.
  return `crop=w='min(iw,ih*${r})':h='min(ih,iw/(${r}))':x='(iw-ow)/2':y='${anchorY(anchor)}'`;
}

const HEX = /^#?([0-9a-f]{6})$/i;

/** Light sharpen after enlarging a cropped source (keeps upscaled clips crisp without halos). */
const SHARPEN = 'unsharp=5:5:0.6:5:5:0.0';

/**
 * filter_complex fragment reading [in] and writing [out].
 * Returns the graph lines; the caller joins them with ';'.
 */
export function layoutGraph(cfg: LayoutConfig, W: number, H: number, input = '0:v', out = 'base'): string[] {
  const mode = cfg.layout ?? 'fill';
  if (mode === 'fill') {
    const yExpr = cfg.position === 'top' ? '0' : cfg.position === 'bottom' ? 'ih-oh' : '(ih-oh)/2';
    // Optional content crop first (zooms in), then cover the frame.
    const pre = contentCrop(cfg.crop_ratio, cfg.position);
    return [`[${input}]${pre ? `${pre},` : ''}scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}:(iw-ow)/2:${yExpr},${SHARPEN},setsar=1[${out}]`];
  }
  const crop = contentCrop(cfg.crop_ratio, cfg.position);
  const fg = `${crop ? `${crop},` : ''}scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,${SHARPEN},setsar=1`;
  const bg = cfg.background ?? 'blur';
  if (bg === 'blur') {
    return [
      `[${input}]split=2[lf_bg][lf_fg]`,
      `[lf_bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,setsar=1[lf_bgb]`,
      `[lf_fg]${fg}[lf_fgs]`,
      `[lf_bgb][lf_fgs]overlay=(W-w)/2:(H-h)/2[${out}]`,
    ];
  }
  const color = bg === 'color' && HEX.test(cfg.background_color ?? '') ? `0x${HEX.exec(cfg.background_color!)![1]}` : 'black';
  return [`[${input}]${fg},pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${color}[${out}]`];
}
