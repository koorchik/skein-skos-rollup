/**
 * Exponential backoff for transient provider failures (HTTP 429 / 5xx, dropped connections).
 *
 * Opt-in: `LlmClient` only retries when constructed with a `retry` option, so every existing arm
 * and every existing test keeps its single-attempt semantics (a judge's never-abort posture is
 * implemented at the operator level, and a retried transcript would otherwise look like a second
 * call). The one-off enrichments (`bin/enrich-family-hint.ts`) opt in.
 *
 * Delay for attempt `i` (0-based, after the failed try): `min(maxMs, baseMs · 2^i) · (1 ± jitter)`.
 */
export interface RetryOptions {
  /** Total attempts including the first. */
  maxTries?: number;
  baseMs?: number;
  maxMs?: number;
  /** Fraction of the delay drawn uniformly at random in both directions. */
  jitter?: number;
  isRetryable?: (error: unknown) => boolean;
  /** Injection points for tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

const DEFAULTS = { maxTries: 5, baseMs: 500, maxMs: 8000, jitter: 0.25 };

/** HTTP status from the shapes our backends throw (`status`, `statusCode`, or a status in the message). */
export function statusOf(error: unknown): number | null {
  if (error && typeof error === 'object') {
    for (const key of ['status', 'statusCode', 'status_code']) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === 'number') return value;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      const match = message.match(/\b(429|5\d\d)\b/);
      if (match) return Number(match[1]);
    }
  }
  return null;
}

export function isTransient(error: unknown): boolean {
  const status = statusOf(error);
  if (status !== null) return status === 429 || (status >= 500 && status <= 599);
  const message = error instanceof Error ? `${error.message} ${(error as { code?: string }).code ?? ''}` : String(error);
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|socket hang up|fetch failed|network|timed? ?out/i.test(message);
}

export function backoffDelay(attempt: number, options: RetryOptions = {}): number {
  const { baseMs, maxMs, jitter } = { ...DEFAULTS, ...options };
  const random = options.random ?? Math.random;
  const nominal = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.round(nominal * (1 + jitter * (2 * random() - 1)));
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxTries = options.maxTries ?? DEFAULTS.maxTries;
  const isRetryable = options.isRetryable ?? isTransient;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt + 1 >= maxTries || !isRetryable(error)) throw error;
      const delayMs = backoffDelay(attempt, options);
      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}
