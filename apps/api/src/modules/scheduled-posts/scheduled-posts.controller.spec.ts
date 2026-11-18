import { ScheduledPostsController } from './scheduled-posts.controller';

describe('ScheduledPostsController', () => {
  const user = { sub: 'user-1' } as never;
  const service = {
    createUploadUrl: jest.fn().mockResolvedValue({ upload_url: 'u' }),
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({ id: 'p1' }),
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    reschedule: jest.fn().mockResolvedValue({ id: 'p1' }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
    publishNow: jest.fn().mockResolvedValue({ id: 'p1' }),
    retry: jest.fn().mockResolvedValue({ id: 'p1' }),
  };
  const controller = new ScheduledPostsController(service as never);
  const dto = { targets: [] } as never;

  it.each([
    ['uploadUrl', () => controller.uploadUrl(user, dto), 'createUploadUrl'],
    ['list', () => controller.list(user, {}), 'list'],
    ['calendar', () => controller.calendar(user, {}), 'list'],
    ['get', () => controller.get(user, 'p1'), 'get'],
    ['create', () => controller.create(user, dto), 'create'],
    ['update', () => controller.update(user, 'p1', dto), 'update'],
    ['reschedule', () => controller.reschedule(user, 'p1', dto), 'reschedule'],
    ['remove', () => controller.remove(user, 'p1'), 'remove'],
    ['publishNow', () => controller.publishNow(user, 'p1'), 'publishNow'],
    ['retry', () => controller.retry(user, 'p1', {}), 'retry'],
  ] as const)('%s delegates to the service for the current user', async (_, call, method) => {
    const res = await call();
    expect((service as Record<string, jest.Mock>)[method].mock.calls.at(-1)?.[0]).toBe('user-1');
    expect(res).toEqual(expect.objectContaining({ success: true }));
  });
});
