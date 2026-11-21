import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { planFor } from '../../common/plans';
import { StorageService } from '../storage/storage.service';
import { UsersRepository } from '../users/users.repository';
import {
  ASSET_KINDS,
  AssetKind,
  BRAND_CAPTION_PRESETS,
  BRAND_PRESET_TEMPLATES,
  BrandCaptionPreset,
  DEFAULT_COLORS,
  MAX_BUMPER_SECONDS,
  brandAssetPrefix,
} from './brand-kit.constants';
import { BrandKitRow, BrandKitsRepository } from './brand-kits.repository';
import { CreateAssetUploadDto, CreateBrandKitDto, UpdateBrandKitDto } from './dto/brand-kit.dto';

export const BRAND_KIT_UPGRADE_MESSAGE =
  'Brand Kit is available on the Creator, Pro and Business plans. Upgrade to create your brand kit.';

const ASSET_FIELDS = ['logo_path', 'intro_path', 'outro_path'] as const;
type AssetField = (typeof ASSET_FIELDS)[number];

/** What the render worker needs from a kit — resolved server-side, never from the client. */
export interface BrandRenderConfig {
  kit_id: string;
  name: string;
  logo_path: string | null;
  logo: { position: string; size: number; opacity: number };
  intro_path: string | null;
  outro_path: string | null;
  max_bumper_seconds: number;
  /** Caption engine style id (from the preset), plus overrides. */
  caption_style: string | null;
  captions: Record<string, unknown>;
}

@Injectable()
export class BrandKitsService {
  private readonly logger = new Logger(BrandKitsService.name);

  constructor(
    private readonly repo: BrandKitsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly storage: StorageService,
  ) {}

  /** Plan check on every call, from the profile tier (never the request). */
  async entitlement(userId: string) {
    const plan = planFor((await this.usersRepo.getById(userId))?.subscription_tier);
    return { allowed: plan.brandKits, max: plan.maxBrandKits, planName: plan.name };
  }

  private async assertAllowed(userId: string) {
    const e = await this.entitlement(userId);
    if (!e.allowed) throw new ForbiddenException(BRAND_KIT_UPGRADE_MESSAGE);
    return e;
  }

  private bucket() {
    return this.storage.videosBucket();
  }

  /* ─── Reads ──────────────────────────────────────────────────────────── */

  async list(userId: string) {
    const e = await this.assertAllowed(userId);
    const rows = await this.repo.list(userId);
    return { items: await Promise.all(rows.map((r) => this.present(r))), limit: e.max, count: rows.length };
  }

  async get(userId: string, id: string) {
    await this.assertAllowed(userId);
    return this.present(await this.mustGet(userId, id));
  }

  private async mustGet(userId: string, id: string): Promise<BrandKitRow> {
    const row = await this.repo.get(userId, id);
    if (!row) throw new NotFoundException('Brand kit not found');
    return row;
  }

  /** Row plus short-lived signed URLs for previews. Paths stay server-side identifiers. */
  private async present(row: BrandKitRow) {
    const sign = async (p: string | null) => (p ? this.storage.createSignedDownloadUrl(this.bucket(), p, 3600) : null);
    const [logo_url, intro_url, outro_url] = await Promise.all([sign(row.logo_path), sign(row.intro_path), sign(row.outro_path)]);
    const { user_id: _omit, ...rest } = row;
    void _omit;
    return { ...rest, colors: { ...DEFAULT_COLORS, ...(row.colors ?? {}) }, logo_url, intro_url, outro_url };
  }

  /* ─── Writes ─────────────────────────────────────────────────────────── */

  async create(userId: string, dto: CreateBrandKitDto) {
    const e = await this.assertAllowed(userId);
    if ((await this.repo.count(userId)) >= e.max) {
      throw new ForbiddenException(
        `Your ${e.planName} plan includes up to ${e.max} brand kits. Delete one or upgrade for more.`,
      );
    }
    await this.assertOwnAssets(userId, dto);
    const isFirst = (await this.repo.count(userId)) === 0;
    const makeDefault = dto.is_default === true || isFirst;
    if (makeDefault) await this.repo.clearDefault(userId);

    const row = await this.repo.insert({
      user_id: userId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      logo_path: dto.logo_path ?? null,
      intro_path: dto.intro_path ?? null,
      outro_path: dto.outro_path ?? null,
      intro_enabled: !!dto.intro_enabled && !!dto.intro_path,
      outro_enabled: !!dto.outro_enabled && !!dto.outro_path,
      colors: { ...DEFAULT_COLORS, ...(dto.colors ?? {}) },
      typography: { ...(dto.typography ?? {}) },
      captions: { ...(dto.captions ?? {}) },
      logo: { ...(dto.logo ?? {}) },
      is_default: makeDefault,
    });
    return this.present(row);
  }

  async update(userId: string, id: string, dto: UpdateBrandKitDto) {
    await this.assertAllowed(userId);
    const current = await this.mustGet(userId, id);
    await this.assertOwnAssets(userId, dto);

    const patch: Partial<BrandKitRow> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description?.trim() || null;
    for (const f of ASSET_FIELDS) if (dto[f] !== undefined) patch[f] = dto[f] ?? null;
    if (dto.colors) patch.colors = { ...current.colors, ...dto.colors };
    if (dto.typography) patch.typography = { ...current.typography, ...dto.typography };
    if (dto.captions) patch.captions = { ...current.captions, ...dto.captions };
    if (dto.logo) patch.logo = { ...current.logo, ...dto.logo };
    const intro = patch.intro_path !== undefined ? patch.intro_path : current.intro_path;
    const outro = patch.outro_path !== undefined ? patch.outro_path : current.outro_path;
    if (dto.intro_enabled !== undefined || patch.intro_path !== undefined)
      patch.intro_enabled = !!intro && (dto.intro_enabled ?? current.intro_enabled);
    if (dto.outro_enabled !== undefined || patch.outro_path !== undefined)
      patch.outro_enabled = !!outro && (dto.outro_enabled ?? current.outro_enabled);

    const row = await this.repo.update(userId, id, patch);
    if (!row) throw new NotFoundException('Brand kit not found');

    // Replaced assets: delete the old file unless another kit still uses it.
    for (const f of ASSET_FIELDS) {
      if (patch[f] !== undefined && current[f] && current[f] !== patch[f]) await this.removeAssetIfUnused(userId, current[f]!);
    }
    return this.present(row);
  }

  async remove(userId: string, id: string) {
    await this.assertAllowed(userId);
    const current = await this.mustGet(userId, id);
    await this.repo.remove(userId, id);
    for (const f of ASSET_FIELDS) if (current[f]) await this.removeAssetIfUnused(userId, current[f]!);
    // Keep a default if any kits remain.
    if (current.is_default) {
      const [next] = await this.repo.list(userId);
      if (next) await this.repo.update(userId, next.id, { is_default: true });
    }
    return { deleted: true };
  }

  async duplicate(userId: string, id: string) {
    const e = await this.assertAllowed(userId);
    const src = await this.mustGet(userId, id);
    if ((await this.repo.count(userId)) >= e.max) {
      throw new ForbiddenException(`Your ${e.planName} plan includes up to ${e.max} brand kits.`);
    }
    // Assets are shared by path; deletion only removes a file once nothing references it.
    const row = await this.repo.insert({
      user_id: userId,
      name: `${src.name} (copy)`.slice(0, 60),
      description: src.description,
      logo_path: src.logo_path,
      intro_path: src.intro_path,
      outro_path: src.outro_path,
      intro_enabled: src.intro_enabled,
      outro_enabled: src.outro_enabled,
      colors: src.colors,
      typography: src.typography,
      captions: src.captions,
      logo: src.logo,
      is_default: false,
    });
    return this.present(row);
  }

  async setDefault(userId: string, id: string) {
    await this.assertAllowed(userId);
    await this.mustGet(userId, id);
    await this.repo.clearDefault(userId);
    return this.present((await this.repo.update(userId, id, { is_default: true }))!);
  }

  /* ─── Assets ─────────────────────────────────────────────────────────── */

  /** Signed upload URL for a logo / intro / outro, under the user's own prefix. */
  async createAssetUpload(userId: string, dto: CreateAssetUploadDto) {
    await this.assertAllowed(userId);
    const kind = ASSET_KINDS[dto.kind as AssetKind];
    const mime = dto.mime_type.toLowerCase();
    if (!(kind.mimes as readonly string[]).includes(mime)) {
      throw new BadRequestException(`Unsupported file type. Allowed: ${kind.mimes.join(', ')}.`);
    }
    if (dto.size > kind.maxBytes) {
      throw new BadRequestException(`File is too large (max ${Math.round(kind.maxBytes / 1024 / 1024)} MB).`);
    }
    const ext = (kind.ext as Record<string, string>)[mime];
    const path = `${brandAssetPrefix(userId)}${dto.kind}-${randomUUID()}.${ext}`;
    const signed = await this.storage.createSignedUploadUrl(path, this.bucket());
    return { path, upload_url: signed.signedUrl };
  }

  /** Asset paths must be the caller's own uploads, and must exist. */
  private async assertOwnAssets(userId: string, dto: Partial<Record<AssetField, string | null>>) {
    for (const f of ASSET_FIELDS) {
      const p = dto[f];
      if (!p) continue;
      if (!p.startsWith(brandAssetPrefix(userId)) || p.includes('..')) {
        throw new BadRequestException('Invalid asset.');
      }
      if (!(await this.storage.objectExists(this.bucket(), p))) {
        throw new BadRequestException('That upload was not found. Please upload the file again.');
      }
    }
  }

  private async removeAssetIfUnused(userId: string, path: string) {
    try {
      if (await this.repo.assetInUse(userId, path)) return;
      await this.storage.removeObjects(this.bucket(), [path]);
    } catch (err) {
      this.logger.warn(`Could not remove brand asset ${path}: ${(err as Error).message}`);
    }
  }

  /** Built-in templates, shown next to the user's own kits (paid plans). */
  async presets(userId: string) {
    await this.assertAllowed(userId);
    return BRAND_PRESET_TEMPLATES;
  }

  /* ─── Rendering ──────────────────────────────────────────────────────── */

  /**
   * Resolve a kit for a render job. Called by video submission with the
   * client's chosen id; re-checks plan and ownership so a Starter user or a
   * foreign id can't sneak a kit into a job.
   */
  async renderConfig(userId: string, kitId: string): Promise<BrandRenderConfig> {
    await this.assertAllowed(userId);
    if (kitId.startsWith('preset:')) {
      const preset = BRAND_PRESET_TEMPLATES.find((p) => p.id === kitId);
      if (!preset) throw new NotFoundException('Brand kit not found');
      return {
        kit_id: preset.id,
        name: preset.name,
        logo_path: null,
        logo: { position: 'top-right', size: 14, opacity: 0.9 },
        intro_path: null,
        outro_path: null,
        max_bumper_seconds: MAX_BUMPER_SECONDS,
        caption_style: BRAND_CAPTION_PRESETS[preset.captions.preset as BrandCaptionPreset],
        captions: { ...preset.captions },
      };
    }
    const kit = await this.mustGet(userId, kitId);
    const caps = (kit.captions ?? {}) as Record<string, unknown>;
    const preset = caps.preset as BrandCaptionPreset | undefined;
    const logo = (kit.logo ?? {}) as Record<string, unknown>;
    return {
      kit_id: kit.id,
      name: kit.name,
      logo_path: kit.logo_path,
      logo: {
        position: (logo.position as string) ?? 'top-right',
        size: (logo.size as number) ?? 14,
        opacity: (logo.opacity as number) ?? 0.9,
      },
      intro_path: kit.intro_enabled ? kit.intro_path : null,
      outro_path: kit.outro_enabled ? kit.outro_path : null,
      max_bumper_seconds: MAX_BUMPER_SECONDS,
      caption_style: preset ? BRAND_CAPTION_PRESETS[preset] : null,
      captions: {
        font: caps.font ?? (kit.typography as Record<string, unknown>)?.caption_font,
        size: caps.size,
        color: caps.color ?? kit.colors?.text,
        highlight_color: caps.highlight_color ?? kit.colors?.primary,
        background_color: caps.background_color,
        background: caps.background,
        outline: caps.outline,
        shadow: caps.shadow,
        position: caps.position,
        alignment: caps.alignment,
        max_words: caps.max_words,
      },
    };
  }
}
