-- Per-type email preferences. The master switch (email_notifications_enabled)
-- still gates everything; these are kept separately so turning the master
-- switch off and on again restores the user's individual choices.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clips_ready_email_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS platform_email_notifications boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.clips_ready_email_notifications IS
  'When false, no "your clips are ready" emails are sent.';
COMMENT ON COLUMN profiles.platform_email_notifications IS
  'When false, no platform connected/disconnected emails are sent.';
