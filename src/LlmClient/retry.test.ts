import { backoffDelay, isTransient, statusOf, withRetry } from './retry';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const noSleep = async () => {};

describe('retry', () => {
  it('returns the first successful result and records each retry', async () => {
    const seen: number[] = [];
    let calls = 0;
    const result = await withRetry(
      async (attempt) => {
        calls += 1;
        if (attempt < 2) throw Object.assign(new Error('rate limited'), { status: 429 });
        return 'ok';
      },
      { sleep: noSleep, random: () => 0.5, onRetry: ({ delayMs }) => seen.push(delayMs) }
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
    assert.deepEqual(seen, [500, 1000]); // random 0.5 → zero jitter
  });

  it('gives up after maxTries and rethrows the last error', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            calls += 1;
            throw new Error('HTTP 503 Service Unavailable');
          },
          { maxTries: 5, sleep: noSleep }
        ),
      /503/
    );
    assert.equal(calls, 5);
  });

  it('does not retry a non-transient error', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            calls += 1;
            throw Object.assign(new Error('bad request'), { status: 400 });
          },
          { sleep: noSleep }
        ),
      /bad request/
    );
    assert.equal(calls, 1);
  });

  it('classifies statuses and connection errors', () => {
    assert.equal(statusOf(Object.assign(new Error('x'), { statusCode: 502 })), 502);
    assert.equal(statusOf(new Error('Gemini 429: quota')), 429);
    assert.equal(statusOf(new Error('plain')), null);
    assert.equal(isTransient(Object.assign(new Error('x'), { status: 500 })), true);
    assert.equal(isTransient(Object.assign(new Error('x'), { status: 404 })), false);
    assert.equal(isTransient(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })), true);
    assert.equal(isTransient(new TypeError('fetch failed')), true);
    assert.equal(isTransient(new Error('invalid JSON')), false);
  });

  it('backs off exponentially with a cap and bounded jitter', () => {
    assert.equal(backoffDelay(0, { random: () => 0.5 }), 500);
    assert.equal(backoffDelay(3, { random: () => 0.5 }), 4000);
    assert.equal(backoffDelay(10, { random: () => 0.5 }), 8000);
    assert.equal(backoffDelay(0, { random: () => 1 }), 625); // +25 %
    assert.equal(backoffDelay(0, { random: () => 0 }), 375); // −25 %
  });
});
