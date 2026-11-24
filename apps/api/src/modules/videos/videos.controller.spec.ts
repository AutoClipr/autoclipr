import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

describe('VideosController', () => {
  let controller: VideosController;
  let service: jest.Mocked<VideosService>;
  const user = { sub: 'u1', email: 'u1@test.dev' };

  beforeEach(() => {
    service = {
      initUpload: jest.fn(),
      importFromUrl: jest.fn(),
      delete: jest.fn(),
      completeUpload: jest.fn(),
      list: jest.fn(),
      findDuplicate: jest.fn(),
      getPipeline: jest.fn(),
      get: jest.fn(),
    } as unknown as jest.Mocked<VideosService>;

    controller = new VideosController(service);
  });

  it('initUpload delegates to the service and wraps the result', async () => {
    service.initUpload.mockResolvedValue({ video_id: 'v1' } as never);
    const dto = { title: 't', filename: 'f.mp4' };

    const result = await controller.initUpload(user, dto as never);

    expect(service.initUpload).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ success: true, data: { video_id: 'v1' }, meta: undefined });
  });

  it('importUrl delegates to the service and wraps the result', async () => {
    service.importFromUrl.mockResolvedValue({ video_id: 'v1' } as never);
    const dto = { url: 'https://youtube.com/watch?v=1' };

    const result = await controller.importUrl(user, dto as never);

    expect(service.importFromUrl).toHaveBeenCalledWith('u1', dto);
    expect(result.data).toEqual({ video_id: 'v1' });
  });

  it('deleteByBody delegates using dto.video_id', async () => {
    service.delete.mockResolvedValue({ deleted: true, id: 'v1' });

    const result = await controller.deleteByBody(user, { video_id: 'v1' });

    expect(service.delete).toHaveBeenCalledWith('u1', 'v1');
    expect(result.data).toEqual({ deleted: true, id: 'v1' });
  });

  it('complete delegates to completeUpload', async () => {
    service.completeUpload.mockResolvedValue({ status: 'processing', credit_cost: 5 });

    const result = await controller.complete(user, 'v1', { clip_count: 5 });

    expect(service.completeUpload).toHaveBeenCalledWith('u1', 'v1', { clip_count: 5 });
    expect(result.data).toEqual({ status: 'processing', credit_cost: 5 });
  });

  it('complete passes an empty options object when no body is sent', async () => {
    service.completeUpload.mockResolvedValue({ status: 'processing', credit_cost: 5 });
    await controller.complete(user, 'v1', undefined as never);
    expect(service.completeUpload).toHaveBeenCalledWith('u1', 'v1', {});
  });

  describe('duplicate', () => {
    it('parses numbers and returns the match', async () => {
      service.findDuplicate.mockResolvedValue({ id: 'v9' } as never);
      const result = await controller.duplicate(user, 'Ashke', '218', '1000');
      expect(service.findDuplicate).toHaveBeenCalledWith('u1', 'Ashke', 218, 1000);
      expect(result.data).toEqual({ duplicate: { id: 'v9' } });
    });

    it('ignores missing or non-numeric values', async () => {
      service.findDuplicate.mockResolvedValue(null);
      const result = await controller.duplicate(user, undefined, 'abc', '');
      expect(service.findDuplicate).toHaveBeenCalledWith('u1', '', undefined, undefined);
      expect(result.data).toEqual({ duplicate: null });
    });
  });

  describe('list', () => {
    it('computes pagination meta and has_more = false when items exactly fill the page', async () => {
      service.list.mockResolvedValue({ items: [{ id: 'v1' }], total: 20 } as never);

      const result = await controller.list(user, '1', '20');

      expect(service.list).toHaveBeenCalledWith('u1', 1, 20);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 20, has_more: false });
    });

    it('sets has_more = true when more pages remain', async () => {
      service.list.mockResolvedValue({ items: [], total: 50 } as never);

      const result = await controller.list(user, '1', '10');

      expect(result.meta?.has_more).toBe(true);
    });

    it('defaults page/limit when query params are absent', async () => {
      service.list.mockResolvedValue({ items: [], total: 0 } as never);

      await controller.list(user, undefined, undefined);

      expect(service.list).toHaveBeenCalledWith('u1', 1, 20);
    });
  });

  it('pipeline delegates to getPipeline', async () => {
    service.getPipeline.mockResolvedValue({ video_id: 'v1' } as never);

    const result = await controller.pipeline(user, 'v1');

    expect(service.getPipeline).toHaveBeenCalledWith('u1', 'v1');
    expect(result.data).toEqual({ video_id: 'v1' });
  });

  it('get delegates to service.get', async () => {
    service.get.mockResolvedValue({ id: 'v1' } as never);

    const result = await controller.get(user, 'v1');

    expect(service.get).toHaveBeenCalledWith('u1', 'v1');
    expect(result.data).toEqual({ id: 'v1' });
  });

  it('delete (DELETE route) delegates to service.delete', async () => {
    service.delete.mockResolvedValue({ deleted: true, id: 'v1' });

    const result = await controller.delete(user, 'v1');

    expect(service.delete).toHaveBeenCalledWith('u1', 'v1');
    expect(result.data).toEqual({ deleted: true, id: 'v1' });
  });

  it('deleteViaPost delegates to service.delete', async () => {
    service.delete.mockResolvedValue({ deleted: true, id: 'v1' });

    const result = await controller.deleteViaPost(user, 'v1');

    expect(service.delete).toHaveBeenCalledWith('u1', 'v1');
    expect(result.data).toEqual({ deleted: true, id: 'v1' });
  });

  describe('subtitles', () => {
    it('delegates upload and validation', async () => {
      (service as any).createSubtitleUpload = jest.fn().mockResolvedValue({ path: 'p' });
      (service as any).validateSubtitle = jest.fn().mockResolvedValue({ cues: 1 });
      await expect(controller.subtitleUpload({ sub: 'u1' } as never, { filename: 'a.srt', size: 1 })).resolves.toMatchObject({ data: { path: 'p' } });
      await expect(controller.subtitleValidate({ sub: 'u1' } as never, { path: 'p' })).resolves.toMatchObject({ data: { cues: 1 } });
    });
  });

  it('lists hook templates', async () => {
    (service as any).hookTemplates = jest.fn().mockResolvedValue({ access: 'all', templates: [] });
    await expect(controller.hookTemplates({ sub: 'u1' } as never)).resolves.toMatchObject({ data: { access: 'all' } });
  });
});
