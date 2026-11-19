/**
 * Errors carry two messages: the detailed one (for logs and monitoring) and,
 * optionally, a short one that is safe to show the user. Anything that looks
 * like internal config or infrastructure detail never reaches the UI.
 */

export const GENERIC_USER_ERROR =
  "Something went wrong on our side while processing this video. Please try again in a few minutes — if it keeps happening, contact support.";

export const BUSY_USER_ERROR =
  'Our AI service is busy right now. Please try again in a minute or two.';

export type UserFacingError = Error & { userMessage?: string };

export function withUserMessage(err: Error, userMessage: string): UserFacingError {
  (err as UserFacingError).userMessage = userMessage;
  return err;
}

/** Internal detail users can't act on: env vars, keys, vendor dashboards, infra. */
const INTERNAL_DETAIL =
  /api[_ ]?key|\.env\b|OPENAI|openai\.com|anthropic|billing|quota|SUPABASE|DATABASE_URL|REDIS|ECONN|ETIMEDOUT|ENOTFOUND|socket hang up|stack|SQL|relation "|ffmpeg|ffprobe|spawn |ENOENT|EACCES|undefined|null|TypeError|ReferenceError/i;

/** The message to store where the user will see it. */
export function toUserMessage(err: unknown): string {
  if (err instanceof Error) {
    const own = (err as UserFacingError).userMessage;
    if (own) return own;
    const msg = err.message.trim();
    if (msg && msg.length <= 300 && !INTERNAL_DETAIL.test(msg)) return msg;
  }
  return GENERIC_USER_ERROR;
}
