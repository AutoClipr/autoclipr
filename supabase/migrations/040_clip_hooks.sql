-- AI Hook & Headline: what was applied to each clip (kind, template, text,
-- placement, duration, sound, position, ratio). Null when no hook was used.
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS hook jsonb;
