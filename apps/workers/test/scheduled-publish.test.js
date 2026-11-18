const test = require('node:test');
const assert = require('node:assert/strict');
const { overallStatus, isPermanentPublishError } = require('../dist/publish/scheduled-publish.service');

test('overall status: every destination published', () => {
  assert.equal(overallStatus(['published', 'published']), 'published');
});

test('overall status: one published, one failed is partially published', () => {
  assert.equal(overallStatus(['published', 'failed']), 'partially_published');
});

test('overall status: anything in flight means publishing', () => {
  assert.equal(overallStatus(['published', 'retrying']), 'publishing');
  assert.equal(overallStatus(['queued']), 'publishing');
});

test('overall status: a destination still waiting keeps it scheduled', () => {
  assert.equal(overallStatus(['failed', 'scheduled']), 'scheduled');
});

test('overall status: all failed, and no destinations', () => {
  assert.equal(overallStatus(['failed', 'failed']), 'failed');
  assert.equal(overallStatus([]), 'draft');
});

test('auth and connection problems are not retried', () => {
  assert.ok(isPermanentPublishError('YouTube posting account not authorized. Go to Settings'));
  assert.ok(isPermanentPublishError('instagram is not connected'));
  assert.ok(isPermanentPublishError('TikTok posting is not available yet.'));
});

test('network and rate-limit errors are retried', () => {
  assert.ok(!isPermanentPublishError('Request failed with status 429'));
  assert.ok(!isPermanentPublishError('socket hang up'));
});
