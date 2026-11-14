/**
 * Estimate when a processing job will finish by extrapolating its elapsed time
 * over the progress made so far (elapsed / progress * 100).
 *
 * Returns null until there's enough signal for a sensible estimate: the job has
 * started, made at least MIN_PROGRESS_FOR_ETA percent progress, and isn't done.
 */
export const MIN_PROGRESS_FOR_ETA = 10;

export function estimateCompletionAt(
  startedAt: string | Date | null | undefined,
  progressPercent: number,
  now: Date = new Date(),
): string | null {
  if (!startedAt) return null;
  if (progressPercent < MIN_PROGRESS_FOR_ETA || progressPercent >= 100) return null;

  const started = new Date(startedAt).getTime();
  const elapsed = now.getTime() - started;
  if (!Number.isFinite(started) || elapsed <= 0) return null;

  const total = (elapsed * 100) / progressPercent;
  return new Date(started + total).toISOString();
}
