import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BrandKitsService } from './brand-kits.service';
import { BrandKitRow } from './brand-kits.repository';

const U = 'user-1';
const kit = (o: Partial<BrandKitRow> = {}): BrandKitRow => ({
  id: 'k1', user_id: U, name: 'My brand', description: null,
  logo_path: null, intro_path: null, outro_path: null, intro_enabled: false, outro_enabled: false,
  colors: {}, typography: {}, captions: {}, logo: {}, is_default: false,
  created_at: 't', updated_at: 't', ...o,
});
const asset = (name: string) => `${U}/brand-kits/${name}`;

describe('BrandKitsService', () => {
  let repo: Record<string, jest.Mock>;
  let users: { getById: jest.Mock };
  let storage: Record<string, jest.Mock>;
  let svc: BrandKitsService;

  beforeEach(() => {
    repo = {
      list: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      get: jest.fn().mockResolvedValue(kit()),
      insert: jest.fn(async (r) => kit(r)),
      update: jest.fn(async (_u, id, p) => kit({ id, ...p })),
      remove: jest.fn().mockResolvedValue(undefined),
      clearDefault: jest.fn().mockResolvedValue(undefined),
      assetInUse: jest.fn().mockResolvedValue(false),
    };
    users = { getById: jest.fn().mockResolvedValue({ subscription_tier: 'creator' }) };
    storage = {
      videosBucket: jest.fn().mockReturnValue('videos'),
      createSignedDownloadUrl: jest.fn(async (_b, p) => `https://signed/${p}`),
      createSignedUploadUrl: jest.fn(async (p) => ({ signedUrl: `https://up/${p}`, path: p })),
      objectExists: jest.fn().mockResolvedValue(true),
      removeObjects: jest.fn().mockResolvedValue(undefined),
    };
    svc = new BrandKitsService(repo as never, users as never, storage as never);
  });

  describe('entitlement', () => {
    it.each([
      ['starter', false, 0],
      ['free', false, 0],
      ['creator', true, 3],
      ['pro', true, 10],
      ['business', true, 25],
    ])('%s → allowed=%s max=%s', async (tier, allowed, max) => {
      users.getById.mockResolvedValue({ subscription_tier: tier });
      await expect(svc.entitlement(U)).resolves.toMatchObject({ allowed, max });
    });

    it('blocks every operation for Starter, server-side', async () => {
      users.getById.mockResolvedValue({ subscription_tier: 'starter' });
      const calls = [
        () => svc.list(U),
        () => svc.get(U, 'k1'),
        () => svc.create(U, { name: 'x' }),
        () => svc.update(U, 'k1', {}),
        () => svc.remove(U, 'k1'),
        () => svc.duplicate(U, 'k1'),
        () => svc.setDefault(U, 'k1'),
        () => svc.createAssetUpload(U, { kind: 'logo', mime_type: 'image/png', size: 10 }),
        () => svc.renderConfig(U, 'k1'),
      ];
      for (const c of calls) await expect(c()).rejects.toThrow(ForbiddenException);
      expect(repo.insert).not.toHaveBeenCalled();
      expect(repo.get).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('lists kits with signed preview URLs and the plan limit, without user ids', async () => {
      repo.list.mockResolvedValue([kit({ logo_path: asset('logo.png') })]);
      const res = await svc.list(U);
      expect(res.limit).toBe(3);
      expect(res.count).toBe(1);
      expect(res.items[0]).toMatchObject({ id: 'k1', logo_url: `https://signed/${asset('logo.png')}`, intro_url: null });
      expect(res.items[0]).not.toHaveProperty('user_id');
      expect(res.items[0].colors.primary).toBe('#54D045');
    });

    it('404s for a kit the user does not own', async () => {
      repo.get.mockResolvedValue(null);
      await expect(svc.get(U, 'other')).rejects.toThrow(NotFoundException);
    });

    it('gets one kit', async () => {
      await expect(svc.get(U, 'k1')).resolves.toMatchObject({ id: 'k1' });
    });
  });

  describe('create', () => {
    it('makes the first kit the default and fills default colours', async () => {
      const res = await svc.create(U, { name: '  My brand ', description: '  ' });
      expect(repo.clearDefault).toHaveBeenCalledWith(U);
      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'My brand', description: null, is_default: true }));
      expect(res.colors.accent).toBe('#00D6A0');
    });

    it('enforces the plan limit', async () => {
      repo.count.mockResolvedValue(3);
      await expect(svc.create(U, { name: 'x' })).rejects.toThrow('up to 3 brand kits');
    });

    it('only enables intro/outro when a file is set, and checks asset ownership', async () => {
      repo.count.mockResolvedValue(1);
      await svc.create(U, { name: 'x', intro_enabled: true, outro_enabled: true, outro_path: asset('o.mp4'), is_default: false });
      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ intro_enabled: false, outro_enabled: true, is_default: false }));
      expect(repo.clearDefault).not.toHaveBeenCalled();

      await expect(svc.create(U, { name: 'x', logo_path: 'someone-else/brand-kits/l.png' })).rejects.toThrow('Invalid asset');
      await expect(svc.create(U, { name: 'x', logo_path: `${U}/brand-kits/../x.png` })).rejects.toThrow('Invalid asset');
      storage.objectExists.mockResolvedValue(false);
      await expect(svc.create(U, { name: 'x', logo_path: asset('missing.png') })).rejects.toThrow(BadRequestException);
    });

    it('can set a new default explicitly', async () => {
      repo.count.mockResolvedValue(1);
      await svc.create(U, { name: 'x', is_default: true });
      expect(repo.clearDefault).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('merges nested settings and removes a replaced asset that is no longer used', async () => {
      repo.get.mockResolvedValue(kit({ logo_path: asset('old.png'), colors: { primary: '#111111' }, intro_path: asset('i.mp4'), intro_enabled: true }));
      await svc.update(U, 'k1', {
        name: ' New ', description: null, logo_path: asset('new.png'),
        colors: { accent: '#222222' }, typography: { caption_font: 'Pacifico' }, captions: { preset: 'neon_highlight' }, logo: { size: 20 },
        intro_path: null,
      });
      expect(repo.update).toHaveBeenCalledWith(U, 'k1', expect.objectContaining({
        name: 'New', description: null, logo_path: asset('new.png'), intro_path: null, intro_enabled: false,
        colors: { primary: '#111111', accent: '#222222' }, typography: { caption_font: 'Pacifico' },
        captions: { preset: 'neon_highlight' }, logo: { size: 20 },
      }));
      expect(storage.removeObjects).toHaveBeenCalledWith('videos', [asset('old.png')]);
      expect(storage.removeObjects).toHaveBeenCalledWith('videos', [asset('i.mp4')]);
    });

    it('keeps an asset another kit still uses, and toggles outro on an existing file', async () => {
      repo.get.mockResolvedValue(kit({ logo_path: asset('shared.png'), outro_path: asset('o.mp4') }));
      repo.assetInUse.mockResolvedValue(true);
      await svc.update(U, 'k1', { logo_path: null, outro_enabled: true });
      expect(storage.removeObjects).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(U, 'k1', expect.objectContaining({ outro_enabled: true }));
    });

    it('404s when the row vanished, and logs asset cleanup failures', async () => {
      repo.update.mockResolvedValueOnce(null);
      await expect(svc.update(U, 'k1', { name: 'x' })).rejects.toThrow(NotFoundException);

      repo.get.mockResolvedValue(kit({ logo_path: asset('a.png') }));
      storage.removeObjects.mockRejectedValue(new Error('storage down'));
      await expect(svc.update(U, 'k1', { logo_path: null })).resolves.toBeDefined();
    });
  });

  describe('remove / duplicate / default', () => {
    it('deletes the kit and its unused assets, and promotes a new default', async () => {
      repo.get.mockResolvedValue(kit({ is_default: true, logo_path: asset('l.png') }));
      repo.list.mockResolvedValue([kit({ id: 'k2' })]);
      await expect(svc.remove(U, 'k1')).resolves.toEqual({ deleted: true });
      expect(repo.remove).toHaveBeenCalledWith(U, 'k1');
      expect(storage.removeObjects).toHaveBeenCalledWith('videos', [asset('l.png')]);
      expect(repo.update).toHaveBeenCalledWith(U, 'k2', { is_default: true });
    });

    it('deleting the last default leaves nothing to promote', async () => {
      repo.get.mockResolvedValue(kit({ is_default: true }));
      await svc.remove(U, 'k1');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('duplicates as a non-default copy, within the limit', async () => {
      repo.count.mockResolvedValue(1);
      await svc.duplicate(U, 'k1');
      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'My brand (copy)', is_default: false }));
      repo.count.mockResolvedValue(3);
      await expect(svc.duplicate(U, 'k1')).rejects.toThrow(ForbiddenException);
    });

    it('sets one default per user', async () => {
      await svc.setDefault(U, 'k1');
      expect(repo.clearDefault).toHaveBeenCalledWith(U);
      expect(repo.update).toHaveBeenCalledWith(U, 'k1', { is_default: true });
    });
  });

  describe('asset uploads', () => {
    it('signs an upload under the user prefix', async () => {
      const res = await svc.createAssetUpload(U, { kind: 'logo', mime_type: 'IMAGE/PNG', size: 1000 });
      expect(res.path).toMatch(new RegExp(`^${U}/brand-kits/logo-[0-9a-f-]+\\.png$`));
      expect(res.upload_url).toBe(`https://up/${res.path}`);
    });

    it('rejects the wrong type or an oversized file', async () => {
      await expect(svc.createAssetUpload(U, { kind: 'logo', mime_type: 'image/svg+xml', size: 10 })).rejects.toThrow('Unsupported file type');
      await expect(svc.createAssetUpload(U, { kind: 'intro', mime_type: 'video/mp4', size: 500 * 1024 * 1024 })).rejects.toThrow('too large');
    });
  });

  describe('preset templates', () => {
    it('lists presets for paid plans only', async () => {
      const presets = await svc.presets(U);
      expect(presets.map((p) => p.id)).toEqual(['preset:bold-green', 'preset:neon-pop', 'preset:clean-white', 'preset:sunset-karaoke']);
      users.getById.mockResolvedValue({ subscription_tier: 'starter' });
      await expect(svc.presets(U)).rejects.toThrow(ForbiddenException);
    });

    it('renders a preset without touching the database', async () => {
      await expect(svc.renderConfig(U, 'preset:neon-pop')).resolves.toMatchObject({
        kit_id: 'preset:neon-pop', name: 'Neon Pop', logo_path: null, intro_path: null, outro_path: null,
        caption_style: 'neon', captions: { highlight_color: '#FF3B9A', position: 'middle' },
      });
      expect(repo.get).not.toHaveBeenCalled();
      await expect(svc.renderConfig(U, 'preset:nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renderConfig', () => {
    it('maps a kit to the worker config, honouring intro/outro toggles', async () => {
      repo.get.mockResolvedValue(kit({
        logo_path: asset('l.png'), logo: { position: 'bottom-left', size: 20, opacity: 0.5 },
        intro_path: asset('i.mp4'), intro_enabled: true, outro_path: asset('o.mp4'), outro_enabled: false,
        colors: { primary: '#54D045', text: '#FFFFFF' }, typography: { caption_font: 'Pacifico' },
        captions: { preset: 'neon_highlight', size: 80, position: 'top' },
      }));
      await expect(svc.renderConfig(U, 'k1')).resolves.toMatchObject({
        kit_id: 'k1', logo_path: asset('l.png'), logo: { position: 'bottom-left', size: 20, opacity: 0.5 },
        intro_path: asset('i.mp4'), outro_path: null, caption_style: 'neon',
        captions: { font: 'Pacifico', size: 80, color: '#FFFFFF', highlight_color: '#54D045', position: 'top' },
      });
    });

    it('fills defaults for a bare kit', async () => {
      await expect(svc.renderConfig(U, 'k1')).resolves.toMatchObject({
        logo: { position: 'top-right', size: 14, opacity: 0.9 }, caption_style: null, intro_path: null,
      });
    });
  });
});
