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

test('a user who downgraded after scheduling is failed without publishing', async () => {
  const { ScheduledPublishService, SCHEDULER_PLAN_ERROR } = require('../dist/publish/scheduled-publish.service');
  const updates = [];
  const db = {
    client: {
      query: async (sql, params) => {
        if (sql.includes("SET status = 'publishing'")) {
          return { rows: [{ id: 't1', scheduled_post_id: 'p1', user_id: 'u1', platform: 'youtube', caption_override: null }] };
        }
        if (sql.includes('FROM scheduled_posts p')) {
          return { rows: [{ id: 'p1', user_id: 'u1', caption: 'hi', media_storage_path: 'u1/a.mp4', subscription_tier: 'starter' }] };
        }
        if (sql.includes('retry_count = retry_count + 1')) updates.push(params);
        return { rows: [] };
      },
    },
  };
  let published = false;
  const publish = { downloadClip: async () => {}, publishToPlatform: async () => { published = true; } };
  const temp = { createJobDir: async () => '/tmp/x', cleanup: async () => {} };
  const svc = new ScheduledPublishService(db, publish, temp, {}, {});
  await assert.rejects(svc.publishTarget('t1', 0), (err) => err.message === SCHEDULER_PLAN_ERROR);
  assert.equal(published, false);
  assert.equal(updates[0][1], 'failed');
});
