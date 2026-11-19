/**
 * What users see when processing fails. Internal detail (API keys, .env,
 * vendor billing pages, infra errors) must never reach the UI.
 */
const test = require('node:test');
const assert = require('node:assert');
const { APIError } = require('openai');
const { toUserMessage, GENERIC_USER_ERROR, BUSY_USER_ERROR } = require('../dist/pipeline/user-error.util.js');
const { formatOpenAiError } = require('../dist/pipeline/openai-error.util.js');

const apiError = (status, code) => new APIError(status, { code, message: 'x' }, 'x', {});

test('invalid OpenAI key shows the generic message', () => {
  const err = formatOpenAiError('OpenAI Whisper', apiError(401, 'invalid_api_key'));
  assert.match(err.message, /OPENAI_API_KEY/); // still in logs
  assert.strictEqual(toUserMessage(err), GENERIC_USER_ERROR);
});

test('rate limit asks the user to retry shortly', () => {
  const err = formatOpenAiError('OpenAI Whisper', apiError(429, 'rate_limit_exceeded'));
  assert.strictEqual(toUserMessage(err), BUSY_USER_ERROR);
});

test('plain user-actionable errors pass through', () => {
  assert.strictEqual(toUserMessage(new Error('This video is private.')), 'This video is private.');
});

test('infra-looking errors are hidden', () => {
  for (const m of ['connect ECONNREFUSED 127.0.0.1:6379', 'ffmpeg exited with code 1', 'Missing SUPABASE_URL in .env']) {
    assert.strictEqual(toUserMessage(new Error(m)), GENERIC_USER_ERROR, m);
  }
  assert.strictEqual(toUserMessage('nope'), GENERIC_USER_ERROR);
});
