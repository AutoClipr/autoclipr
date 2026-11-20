-- Top Creators leaderboard: cached YouTube channel stats.
--
-- Rows are the channels we track (seeded below). A daily API job refreshes the
-- stats from YouTube Data API v3 channels.list and appends a history snapshot,
-- so visitors are always served from this table — never from YouTube directly.
--
-- Separate from public.youtube_channels, which holds channels users connect.

CREATE TABLE IF NOT EXISTS public.creator_channels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id       TEXT NOT NULL UNIQUE,
  channel_handle   TEXT,
  channel_name     TEXT NOT NULL,
  description      TEXT,
  avatar_url       TEXT,
  country          TEXT,
  category         TEXT NOT NULL,
  -- NULL means YouTube hides or didn't return the value. Never store a guess.
  subscriber_count BIGINT,
  total_views      BIGINT,
  video_count      BIGINT,
  published_at     TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at  TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_channels_category ON public.creator_channels(category);
CREATE INDEX IF NOT EXISTS idx_creator_channels_subs ON public.creator_channels(subscriber_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_creator_channels_views ON public.creator_channels(total_views DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_creator_channels_videos ON public.creator_channels(video_count DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.creator_stats_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id       TEXT NOT NULL REFERENCES public.creator_channels(channel_id) ON DELETE CASCADE ON UPDATE CASCADE,
  subscriber_count BIGINT,
  total_views      BIGINT,
  video_count      BIGINT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_stats_history_channel ON public.creator_stats_history(channel_id, recorded_at DESC);

-- One row per refresh run, so the page can show the real last successful refresh.
CREATE TABLE IF NOT EXISTS public.creator_refresh_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  succeeded     BOOLEAN NOT NULL DEFAULT FALSE,
  channels_ok   INTEGER NOT NULL DEFAULT 0,
  channels_failed INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_creator_refresh_runs_success ON public.creator_refresh_runs(succeeded, finished_at DESC);

-- Service role only; the public reads through the API.
ALTER TABLE public.creator_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_stats_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_refresh_runs ENABLE ROW LEVEL SECURITY;

-- Seed the tracked channels (stats arrive on the first refresh).
INSERT INTO public.creator_channels (channel_id, channel_handle, channel_name, category, country) VALUES
  ('UCX6OQ3DkcsbYNE6H8uQQuVA', '@MrBeast',          'MrBeast',           'Entertainment', 'US'),
  ('UCq-Fj5jknLsUf-MWSy4_brA', '@tseries',          'T-Series',          'Music',         'IN'),
  ('UCbCmjCuTUZos6Inko4u57UQ', '@CoComelon',        'Cocomelon',         'Kids',          'US'),
  ('UCpEhnqL0y41EpW2TvWAHD7Q', '@SETIndia',         'SET India',         'Entertainment', 'IN'),
  ('UCvlE5gTbOvjiolFlEm-c_Ow', '@VladandNiki',      'Vlad and Niki',     'Kids',          'US'),
  ('UCbp9MyKCTEww4CxEzc_Tp0Q', '@StokesTwins',      'Stokes Twins',      'Entertainment', 'US'),
  ('UCk8GzjMOrta8yxDcKfylJYw', '@KidsDianaShow',    'Kids Diana Show',   'Kids',          'UA'),
  ('UCJplp5SjeGSdVdwsfb9Q7lQ', '@LikeNastyaofficial','Like Nastya',      'Kids',          'RU'),
  ('UCFFbwnve3yF62-tVXkTyHqg', '@zeemusiccompany',  'Zee Music Company', 'Music',         'IN'),
  ('UC295-Dw_tDNtZXFeAPAW6Aw', '@5MinuteCraftsYouTube','5-Minute Crafts','Lifestyle',     'CY'),
  ('UCrDkAvocapwLoNZ_MhwFe3A', '@BLACKPINK',        'BLACKPINK',         'Music',         'KR'),
  ('UCIwFjwMjI0y7PDBVEO9-bkQ', '@justinbieber',     'Justin Bieber',     'Music',         'CA'),
  ('UCY1kMZp36IQSyNx_9h4mpCg', '@MarkRober',        'Mark Rober',        'Technology',    'US'),
  ('UCRijo3ddMTht_IHyNSNXpNQ', '@DudePerfect',      'Dude Perfect',      'Sports',        'US'),
  ('UCMMJBWA_h1B1v803oZxumiQ', '@NICKIMINAJ',       'Nicki Minaj',       'Music',         'TT'),
  ('UCYLNGLIzMhRTi6ZOLjAPSmw', '@shakira',          'Shakira',           'Music',         'CO'),
  ('UCRWFSbif-RFENbBrSiez1DA', '@ABPNEWS',          'ABP NEWS',          'News',          'IN'),
  ('UCdX5KXiCTPYWYZscfphgQ4g', '@BeatboxJCOP',      'BeatboxJCOP',       'Entertainment', 'MX'),
  ('UCgFXm4TI8htWmCyJ6KiX9rQ', '@ToysandColors',    'Toys and Colors',   'Kids',          'US'),
  ('UC5gxP-2QqIh_09djvlm9Xcg', '@AlansUniverse',    'Alan''s Universe',  'Entertainment', 'PH')
ON CONFLICT (channel_id) DO NOTHING;
