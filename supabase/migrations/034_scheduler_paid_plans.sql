-- Content scheduling is a paid-plan feature: list it on Creator and Business.
UPDATE public.subscription_plans
   SET features = features || '["Content scheduling (Shorts & Reels)"]'::jsonb
 WHERE id IN ('creator', 'business')
   AND NOT features @> '["Content scheduling (Shorts & Reels)"]'::jsonb;
