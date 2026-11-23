-- Analytics for scheduler posts. Posts published by the Content Scheduler live
-- in scheduled_post_targets (not clip_publications), so they get the same
-- metric columns and the analytics page reads both.
ALTER TABLE public.scheduled_post_targets
  ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scheduled_targets_user_published
  ON public.scheduled_post_targets(user_id, published_at DESC)
  WHERE status = 'published';
