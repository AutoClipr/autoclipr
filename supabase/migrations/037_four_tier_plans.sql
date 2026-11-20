-- Four-tier pricing: Starter (free) · Creator ₹599 · Pro ₹999 · Business ₹1,999.
--
-- The API's common/plans.ts is the authority for entitlements (credits,
-- max video length, watermark, platforms, scheduling, analytics). These rows
-- exist because user_subscriptions.plan_id references them, and they carry
-- the marketing feature list shown on the subscription page.
--
-- Only plan definitions change here. Existing subscribers keep their current
-- Dodo product and price; profile credit balances are not touched.

INSERT INTO public.subscription_plans (id, name, price_cents, credits_per_month, max_videos, features, active) VALUES
  ('starter',  'Starter',  0,      30,   NULL,
   '["30 credits / month","Videos up to 5 minutes","AI viral moment detection","Auto captions & subtitles","Vertical 9:16 export","Publish to YouTube Shorts & Instagram Reels","Watermark on exports"]', TRUE),
  ('creator',  'Creator',  59900,  200,  NULL,
   '["200 credits / month","Videos up to 10 minutes","AI viral moment detection","Auto captions & subtitles","No watermark","Content scheduling (Shorts & Reels)","Analytics & performance tracking"]', TRUE),
  ('pro',      'Pro',      99900,  500,  NULL,
   '["500 credits / month","Videos up to 15 minutes","AI viral moment detection","Auto captions & subtitles","No watermark","Content scheduling (Shorts & Reels)","Analytics & performance tracking"]', TRUE),
  ('business', 'Business', 199900, 1200, NULL,
   '["1,200 credits / month","Videos up to 30 minutes","AI viral moment detection","Auto captions & subtitles","No watermark","Content scheduling (Shorts & Reels)","Analytics & performance tracking"]', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  credits_per_month = EXCLUDED.credits_per_month,
  max_videos = EXCLUDED.max_videos,
  features = EXCLUDED.features,
  active = EXCLUDED.active;
