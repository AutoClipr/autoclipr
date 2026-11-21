-- Brand kits: a user's reusable look (logo, colours, fonts, caption style,
-- intro/outro) applied to rendered clips. Paid-plan feature; the API checks
-- the entitlement on every request (common/plans.ts → brandKits).
--
-- Asset columns hold object paths in the private videos bucket under
-- <user_id>/brand-kits/…, never public URLs. The API hands out short-lived
-- signed URLs for previews and the worker downloads with the service role.

CREATE TABLE IF NOT EXISTS public.brand_kits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 280),

  logo_path   TEXT,
  intro_path  TEXT,
  outro_path  TEXT,
  intro_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  outro_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- { primary, secondary, accent, background, text } as #RRGGBB
  colors      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { heading_font, caption_font, font_weight, text_size, alignment }
  typography  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { preset, font, size, color, highlight_color, background_color, outline,
  --   shadow, position, alignment, max_words }
  captions    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { position, size, opacity }
  logo        JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON public.brand_kits(user_id, updated_at DESC);
-- At most one default kit per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_kits_default ON public.brand_kits(user_id) WHERE is_default;

-- Service role only; users go through the API (which enforces plan + ownership).
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
