-- Content Scheduler: posts planned for a future time, published by the worker.
--
-- One scheduled_posts row is the thing the user sees on the calendar. Each
-- destination platform gets its own scheduled_post_targets row with its own
-- status, so one post can be published on Instagram and fail on YouTube, and
-- only the failed destination is retried.
--
-- The database is the source of truth: the worker claims due targets from
-- here every minute, so nothing is lost if Redis or the worker restarts.
-- Destinations reuse platform_connections (one connection per platform).

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Media: either a generated clip or a file uploaded for scheduling.
  clip_id UUID REFERENCES public.clips(id) ON DELETE SET NULL,
  media_storage_path TEXT NOT NULL,       -- path in the clips bucket
  media_thumbnail_url TEXT,
  media_duration_seconds NUMERIC,
  title TEXT,
  caption TEXT NOT NULL DEFAULT '',
  description TEXT,
  hashtags TEXT,
  scheduled_at TIMESTAMPTZ,               -- UTC; null for drafts
  timezone TEXT NOT NULL DEFAULT 'UTC',   -- IANA zone, for display only
  -- draft | scheduled | publishing | published | partially_published | failed | cancelled
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_time ON public.scheduled_posts(user_id, scheduled_at);

CREATE TABLE IF NOT EXISTS public.scheduled_post_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_post_id UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  caption_override TEXT,
  scheduled_at TIMESTAMPTZ,               -- copied from the post; what the worker polls
  -- draft | scheduled | queued | publishing | retrying | published | failed | cancelled
  status TEXT NOT NULL DEFAULT 'draft',
  platform_post_id TEXT,
  platform_post_url TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  publishing_started_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheduled_post_id, platform)
);

-- The worker's poll: due targets that are still waiting.
CREATE INDEX IF NOT EXISTS idx_scheduled_targets_due
  ON public.scheduled_post_targets(scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_targets_post ON public.scheduled_post_targets(scheduled_post_id);

DROP TRIGGER IF EXISTS scheduled_posts_updated_at ON public.scheduled_posts;
CREATE TRIGGER scheduled_posts_updated_at BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS scheduled_post_targets_updated_at ON public.scheduled_post_targets;
CREATE TRIGGER scheduled_post_targets_updated_at BEFORE UPDATE ON public.scheduled_post_targets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Users read their own rows; all writes go through the API's service role.
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_post_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own scheduled posts" ON public.scheduled_posts;
CREATE POLICY "own scheduled posts" ON public.scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own scheduled targets" ON public.scheduled_post_targets;
CREATE POLICY "own scheduled targets" ON public.scheduled_post_targets
  FOR SELECT USING (auth.uid() = user_id);

-- Opt-out for "your post was published / failed" emails.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scheduler_email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
