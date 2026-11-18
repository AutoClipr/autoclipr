import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ScheduledPostsService, SCHEDULER_UPGRADE_MESSAGE } from './scheduled-posts.service';
import { createQueryBuilderMock, createSupabaseAdminServiceMock } from '../../test-utils/supabase-mock';

const USER = 'user-1';
const inAnHour = () => new Date(Date.now() + 3600_000).toISOString();

function post(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    status: 'scheduled',
    scheduled_post_targets: [{ id: 't1', platform: 'youtube', status: 'scheduled' }],
    ...over,
  };
}

describe('ScheduledPostsService', () => {
  let service: ScheduledPostsService;
  let supabase: ReturnType<typeof createSupabaseAdminServiceMock>;
  let posts: ReturnType<typeof createQueryBuilderMock>;
  let targets: ReturnType<typeof createQueryBuilderMock>;
  let profiles: ReturnType<typeof createQueryBuilderMock>;
  let clips: { getById: jest.Mock };
  let platforms: { listByUser: jest.Mock };
  let storage: { createSignedUploadUrl: jest.Mock; clipsBucket: jest.Mock };

  beforeEach(() => {
    supabase = createSupabaseAdminServiceMock();
    posts = createQueryBuilderMock({ data: post(), error: null });
    targets = createQueryBuilderMock({ data: null, error: null });
    profiles = createQueryBuilderMock({ data: { subscription_tier: 'creator' }, error: null });
    supabase.__client.from.mockImplementation((t: string) =>
      t === 'profiles' ? profiles : t === 'scheduled_posts' ? posts : targets,
    );
    clips = {
      getById: jest.fn().mockResolvedValue({
        id: 'c1',
        status: 'completed',
        storage_path: 'u/c1.mp4',
        thumbnail_url: 'thumb',
        duration_seconds: 30,
      }),
    };
    platforms = {
      listByUser: jest.fn().mockResolvedValue([
        { platform: 'youtube', auth_status: 'authorized', has_tokens: true },
        { platform: 'instagram', auth_status: 'connected', has_tokens: false },
      ]),
    };
    storage = {
      createSignedUploadUrl: jest.fn().mockResolvedValue({ signedUrl: 'https://signed', path: 'x' }),
      clipsBucket: jest.fn().mockReturnValue('clips'),
    };
    service = new ScheduledPostsService(supabase as never, clips as never, platforms as never, storage as never);
  });

  describe('paid plan gate', () => {
    const futureIso = () => new Date(Date.now() + 3600_000).toISOString();
    const free = () => profiles.__setResult({ data: { subscription_tier: 'starter' }, error: null });

    it.each([
      ['createUploadUrl', () => service.createUploadUrl('u1', { filename: 'a.mp4', mime_type: 'video/mp4', size: 10 } as never)],
      ['create', () => service.create('u1', { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: futureIso() } as never)],
      ['update', () => service.update('u1', 'p1', { clip_id: 'c1', targets: [] } as never)],
      ['reschedule', () => service.reschedule('u1', 'p1', { scheduled_at: futureIso() } as never)],
      ['publishNow', () => service.publishNow('u1', 'p1')],
      ['retry', () => service.retry('u1', 'p1', {} as never)],
    ])('%s is refused on the free plan', async (_name, call) => {
      free();
      await expect(call()).rejects.toThrow(SCHEDULER_UPGRADE_MESSAGE);
    });

    it('refuses when the profile is missing', async () => {
      profiles.__setResult({ data: null, error: null });
      await expect(service.publishNow('u1', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still lets a free user view and delete posts', async () => {
      free();
      await expect(service.get('u1', 'p1')).resolves.toBeTruthy();
      await expect(service.remove('u1', 'p1')).resolves.toEqual({ deleted: true });
    });

    it('allows the business plan', async () => {
      profiles.__setResult({ data: { subscription_tier: 'business' }, error: null });
      await expect(
        service.createUploadUrl('u1', { filename: 'a.mp4', mime_type: 'video/mp4', size: 10 } as never),
      ).resolves.toHaveProperty('upload_url');
    });
  });

  describe('createUploadUrl', () => {
    it('signs an upload under the user\'s scheduled/ folder', async () => {
      const res = await service.createUploadUrl(USER, { filename: 'My Clip.MP4', mime_type: 'video/mp4', size: 10 });
      expect(res.upload_url).toBe('https://signed');
      expect(res.media_storage_path).toMatch(/^user-1\/scheduled\/[0-9a-f-]+\.mp4$/);
    });

    it('rejects non-video files', async () => {
      await expect(
        service.createUploadUrl(USER, { filename: 'notes.txt', mime_type: 'text/plain', size: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createUploadUrl(USER, { filename: 'noext', mime_type: 'video/mp4', size: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list / get', () => {
    it('filters by date range and status, and by platform in memory', async () => {
      posts.__setResult({
        data: [post(), post({ id: 'p2', scheduled_post_targets: [{ id: 't2', platform: 'instagram', status: 'scheduled' }] })],
        error: null,
      });
      const res = await service.list(USER, {
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-12-01T00:00:00Z',
        status: 'scheduled',
        platform: 'instagram',
      });
      expect(posts.eq).toHaveBeenCalledWith('user_id', USER);
      expect(posts.gte).toHaveBeenCalledWith('scheduled_at', '2026-11-01T00:00:00Z');
      expect(posts.lte).toHaveBeenCalledWith('scheduled_at', '2026-12-01T00:00:00Z');
      expect(res.map((p) => p.id)).toEqual(['p2']);
    });

    it('returns everything without filters, and an empty list for no rows', async () => {
      posts.__setResult({ data: null, error: null });
      await expect(service.list(USER, {})).resolves.toEqual([]);
    });

    it('throws on a database error', async () => {
      posts.__setResult({ data: null, error: { message: 'boom' } });
      await expect(service.list(USER, {})).rejects.toThrow('boom');
      await expect(service.get(USER, 'p1')).rejects.toThrow('boom');
    });

    it('only finds the caller\'s own post', async () => {
      await service.get(USER, 'p1');
      expect(posts.eq).toHaveBeenCalledWith('user_id', USER);
      posts.__setResult({ data: null, error: null });
      await expect(service.get(USER, 'other')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('schedules a library clip for an authorized platform', async () => {
      posts.single = jest.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });
      const at = inAnHour();
      await service.create(USER, {
        clip_id: '11111111-1111-1111-1111-111111111111',
        caption: ' Hello ',
        hashtags: '#a #b',
        targets: [{ platform: 'youtube' }, { platform: 'youtube' }],
        scheduled_at: at,
        timezone: 'Asia/Kolkata',
      });
      expect(posts.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER,
          clip_id: 'c1',
          media_storage_path: 'u/c1.mp4',
          caption: 'Hello',
          status: 'scheduled',
          scheduled_at: at,
          timezone: 'Asia/Kolkata',
        }),
      );
      // Duplicate platforms collapse to one destination.
      expect(targets.insert).toHaveBeenCalledWith([
        expect.objectContaining({ platform: 'youtube', status: 'scheduled', scheduled_at: at, caption_override: null }),
      ]);
    });

    it('saves a draft of an uploaded file without a time or destinations', async () => {
      posts.single = jest.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });
      await service.create(USER, {
        media_storage_path: `${USER}/scheduled/abc.mp4`,
        media_duration_seconds: 12,
        targets: [],
        status: 'draft',
      });
      expect(posts.insert).toHaveBeenCalledWith(
        expect.objectContaining({ clip_id: null, status: 'draft', scheduled_at: null, timezone: 'UTC', caption: '' }),
      );
      expect(targets.insert).not.toHaveBeenCalled();
      expect(platforms.listByUser).not.toHaveBeenCalled();
    });

    it('throws when the insert fails', async () => {
      posts.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } });
      await expect(
        service.create(USER, { media_storage_path: `${USER}/scheduled/a.mp4`, targets: [], status: 'draft' }),
      ).rejects.toThrow('insert failed');
    });

    it('throws when saving destinations fails', async () => {
      posts.single = jest.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });
      targets.__setResult({ data: null, error: { message: 'targets failed' } });
      await expect(
        service.create(USER, { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: inAnHour() }),
      ).rejects.toThrow('targets failed');
    });

    it.each([
      ['another user\'s upload', { media_storage_path: 'someone/scheduled/a.mp4' }],
      ['a path traversal', { media_storage_path: `${USER}/scheduled/../x.mp4` }],
      ['no media', {}],
    ])('rejects %s', async (_, media) => {
      await expect(
        service.create(USER, { ...media, targets: [{ platform: 'youtube' }], scheduled_at: inAnHour() }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a clip the user does not own or that is not ready', async () => {
      clips.getById.mockResolvedValueOnce(null);
      await expect(
        service.create(USER, { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: inAnHour() }),
      ).rejects.toBeInstanceOf(NotFoundException);
      clips.getById.mockResolvedValueOnce({ id: 'c1', status: 'processing', storage_path: null });
      await expect(
        service.create(USER, { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: inAnHour() }),
      ).rejects.toThrow(/not ready/);
    });

    it('requires a destination and a time to schedule', async () => {
      await expect(service.create(USER, { clip_id: 'c1', targets: [], scheduled_at: inAnHour() })).rejects.toThrow(
        /at least one account/,
      );
      await expect(service.create(USER, { clip_id: 'c1', targets: [{ platform: 'youtube' }] })).rejects.toThrow(
        /date and time/,
      );
    });

    it('rejects times in the past or more than a year out', async () => {
      await expect(
        service.create(USER, { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: '2020-01-01T00:00:00Z' }),
      ).rejects.toThrow(/minute from now/);
      const farOut = new Date(Date.now() + 400 * 86400_000).toISOString();
      await expect(
        service.create(USER, { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: farOut }),
      ).rejects.toThrow(/year ahead/);
    });

    it('rejects a platform that is not connected and authorized', async () => {
      await expect(
        service.create(USER, { clip_id: 'c1', targets: [{ platform: 'instagram' }], scheduled_at: inAnHour() }),
      ).rejects.toThrow(/Connect and authorize instagram/);
    });
  });

  describe('update', () => {
    it('replaces the post and its destinations', async () => {
      await service.update(USER, 'p1', {
        clip_id: 'c1',
        targets: [{ platform: 'youtube', caption_override: ' yt ' }],
        scheduled_at: inAnHour(),
      });
      expect(posts.update).toHaveBeenCalled();
      expect(targets.delete).toHaveBeenCalled();
      expect(targets.insert).toHaveBeenCalledWith([expect.objectContaining({ caption_override: 'yt' })]);
    });

    it('throws when the update fails', async () => {
      const updateBuilder = createQueryBuilderMock({ data: null, error: { message: 'update failed' } });
      posts.update = jest.fn(() => updateBuilder);
      await expect(
        service.update(USER, 'p1', { clip_id: 'c1', targets: [{ platform: 'youtube' }], scheduled_at: inAnHour() }),
      ).rejects.toThrow('update failed');
    });

    it('refuses while a destination is being published', async () => {
      posts.__setResult({ data: post({ scheduled_post_targets: [{ id: 't1', platform: 'youtube', status: 'publishing' }] }), error: null });
      await expect(
        service.update(USER, 'p1', { clip_id: 'c1', targets: [], status: 'draft' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses once published', async () => {
      posts.__setResult({ data: post({ status: 'published', scheduled_post_targets: [] }), error: null });
      await expect(
        service.update(USER, 'p1', { clip_id: 'c1', targets: [], status: 'draft' }),
      ).rejects.toThrow(/Only drafts and scheduled/);
    });
  });

  describe('reschedule', () => {
    it('moves the post and its waiting destinations', async () => {
      const at = inAnHour();
      await service.reschedule(USER, 'p1', { scheduled_at: at, timezone: 'Europe/London' });
      expect(posts.update).toHaveBeenCalledWith({ scheduled_at: at, timezone: 'Europe/London' });
      expect(targets.update).toHaveBeenCalledWith({ scheduled_at: at });
      expect(targets.eq).toHaveBeenCalledWith('status', 'scheduled');
    });

    it('keeps the timezone when none is given', async () => {
      const at = inAnHour();
      await service.reschedule(USER, 'p1', { scheduled_at: at });
      expect(posts.update).toHaveBeenCalledWith({ scheduled_at: at });
    });

    it('only reschedules scheduled posts', async () => {
      posts.__setResult({ data: post({ status: 'draft' }), error: null });
      await expect(service.reschedule(USER, 'p1', { scheduled_at: inAnHour() })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes the caller\'s post', async () => {
      await expect(service.remove(USER, 'p1')).resolves.toEqual({ deleted: true });
      expect(posts.delete).toHaveBeenCalled();
    });

    it('refuses while publishing', async () => {
      posts.__setResult({ data: post({ scheduled_post_targets: [{ id: 't1', platform: 'youtube', status: 'queued' }] }), error: null });
      await expect(service.remove(USER, 'p1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('publishNow', () => {
    it('moves waiting destinations to now', async () => {
      await service.publishNow(USER, 'p1');
      expect(targets.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled' }));
      expect(targets.in).toHaveBeenCalledWith('status', ['draft', 'scheduled']);
    });

    it('needs at least one destination', async () => {
      posts.__setResult({ data: post({ scheduled_post_targets: [] }), error: null });
      await expect(service.publishNow(USER, 'p1')).rejects.toThrow(/at least one account/);
      posts.__setResult({ data: post({ scheduled_post_targets: undefined }), error: null });
      await expect(service.publishNow(USER, 'p1')).rejects.toThrow(/at least one account/);
    });
  });

  describe('retry', () => {
    const mixed = post({
      status: 'partially_published',
      scheduled_post_targets: [
        { id: 't1', platform: 'youtube', status: 'published' },
        { id: 't2', platform: 'instagram', status: 'failed' },
      ],
    });

    it('re-queues only the failed destination', async () => {
      posts.__setResult({ data: mixed, error: null });
      await service.retry(USER, 'p1', {});
      expect(targets.update).toHaveBeenCalledTimes(1);
      expect(targets.eq).toHaveBeenCalledWith('id', 't2');
      expect(targets.eq).not.toHaveBeenCalledWith('id', 't1');
    });

    it('can target one platform, and refuses when nothing failed', async () => {
      posts.__setResult({ data: mixed, error: null });
      await expect(service.retry(USER, 'p1', { platform: 'youtube' })).rejects.toThrow(/nothing to retry/);
      posts.__setResult({ data: post({ scheduled_post_targets: undefined }), error: null });
      await expect(service.retry(USER, 'p1', {})).rejects.toThrow(/nothing to retry/);
    });
  });
});
