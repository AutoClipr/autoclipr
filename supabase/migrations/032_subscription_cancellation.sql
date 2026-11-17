-- Self-serve subscription cancellation.
--
-- Cancellation is scheduled with Dodo for the end of the billing period
-- (cancel_at_next_billing_date), so the plan keeps working until
-- current_period_end. These columns record that state locally so the
-- subscription page and access checks do not need a Dodo round trip.
--
-- `stripe_subscription_id` keeps holding the Dodo subscription id (the column
-- name predates the move to Dodo).

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  -- Set when a cancel request starts; doubles as a short lock against
  -- double-clicks and parallel requests.
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  -- When access actually ends (the period end Dodo reported).
  ADD COLUMN IF NOT EXISTS cancellation_effective_at TIMESTAMPTZ,
  -- When the subscription really ended (expired / cancelled at period end).
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  -- Optional "why are you leaving" answer, for product analytics.
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_comment TEXT,
  -- Timestamp of the newest Dodo webhook applied, so a late, older event
  -- cannot roll the row back to a previous state.
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

-- Webhook ids already processed. Dodo may deliver the same event more than
-- once; the insert on this primary key is what makes handling idempotent.
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (API) reads or writes it.
