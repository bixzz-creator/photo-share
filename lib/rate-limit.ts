/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Zero cost and good enough for a single Vercel instance. Each serverless
 * instance keeps its own counters, so swap the store for Upstash Redis
 * (`@upstash/ratelimit`) if you need limits shared across instances.
 */

export interface RateLimitConfig {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  /** Epoch milliseconds when the window resets. */
  reset: number
  retryAfterSeconds: number
}

interface Bucket {
  count: number
  reset: number
}

const buckets = new Map<string, Bucket>()

function prune(now: number) {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key)
  }
}

function result(bucket: Bucket, config: RateLimitConfig, now: number): RateLimitResult {
  const remaining = Math.max(0, config.limit - bucket.count)
  return {
    success: bucket.count <= config.limit,
    limit: config.limit,
    remaining,
    reset: bucket.reset,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.reset - now) / 1000)),
  }
}

/** Counts one hit against `key`. */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  prune(now)

  const existing = buckets.get(key)
  if (!existing || existing.reset <= now) {
    const bucket: Bucket = { count: 1, reset: now + config.windowMs }
    buckets.set(key, bucket)
    return result(bucket, config, now)
  }

  existing.count += 1
  return result(existing, config, now)
}

/** Reads the current state without counting a hit. */
export function peekRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.reset <= now) {
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: now + config.windowMs,
      retryAfterSeconds: 0,
    }
  }
  return result(existing, config, now)
}

export function clearRateLimit(key?: string) {
  if (key) buckets.delete(key)
  else buckets.clear()
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(request: Request & { ip?: string | null }): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? request.ip ?? 'unknown'
}
