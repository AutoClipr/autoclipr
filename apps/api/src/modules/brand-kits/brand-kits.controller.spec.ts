import { BrandKitsController } from './brand-kits.controller';

describe('BrandKitsController', () => {
  const user = { sub: 'u1' } as never;
  const svc = {
    entitlement: jest.fn().mockResolvedValue('e'),
    presets: jest.fn().mockResolvedValue('p'),
    list: jest.fn().mockResolvedValue('l'),
    createAssetUpload: jest.fn().mockResolvedValue('a'),
    get: jest.fn().mockResolvedValue('g'),
    create: jest.fn().mockResolvedValue('c'),
    update: jest.fn().mockResolvedValue('u'),
    remove: jest.fn().mockResolvedValue('r'),
    duplicate: jest.fn().mockResolvedValue('d'),
    setDefault: jest.fn().mockResolvedValue('s'),
  };
  const ctrl = new BrandKitsController(svc as never);

  it('delegates every route to the service for the caller', async () => {
    const ok = (data: unknown) => ({ success: true, data, meta: undefined });
    await expect(ctrl.entitlement(user)).resolves.toEqual(ok('e'));
    await expect(ctrl.list(user)).resolves.toEqual(ok('l'));
    await expect(ctrl.presets(user)).resolves.toEqual(ok('p'));
    await expect(ctrl.createAssetUpload(user, { kind: 'logo', mime_type: 'image/png', size: 1 })).resolves.toEqual(ok('a'));
    await expect(ctrl.get(user, 'k')).resolves.toEqual(ok('g'));
    await expect(ctrl.create(user, { name: 'n' })).resolves.toEqual(ok('c'));
    await expect(ctrl.update(user, 'k', {})).resolves.toEqual(ok('u'));
    await expect(ctrl.remove(user, 'k')).resolves.toEqual(ok('r'));
    await expect(ctrl.duplicate(user, 'k')).resolves.toEqual(ok('d'));
    await expect(ctrl.setDefault(user, 'k')).resolves.toEqual(ok('s'));
    expect(svc.update).toHaveBeenCalledWith('u1', 'k', {});
  });
});
