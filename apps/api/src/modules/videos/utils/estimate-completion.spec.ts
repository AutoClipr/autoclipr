import { estimateCompletionAt } from './estimate-completion';

describe('estimateCompletionAt', () => {
  const now = new Date('2026-11-14T10:00:00.000Z');

  it('extrapolates elapsed time over progress', () => {
    // 2 minutes in at 50% → done 2 minutes from now
    expect(estimateCompletionAt('2026-11-14T09:58:00.000Z', 50, now)).toBe('2026-11-14T10:02:00.000Z');
  });

  it('returns null before the job has started', () => {
    expect(estimateCompletionAt(null, 50, now)).toBeNull();
  });

  it.each([0, 5, 100])('returns null at %i%% progress', (pct) => {
    expect(estimateCompletionAt('2026-11-14T09:58:00.000Z', pct, now)).toBeNull();
  });

  it('returns null for a start time in the future or invalid', () => {
    expect(estimateCompletionAt('2026-11-14T10:05:00.000Z', 50, now)).toBeNull();
    expect(estimateCompletionAt('not-a-date', 50, now)).toBeNull();
  });
});
