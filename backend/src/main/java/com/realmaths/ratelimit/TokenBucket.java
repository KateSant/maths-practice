package com.realmaths.ratelimit;

import java.time.Duration;

/**
 * A token bucket with lazy refill.
 *
 * <p>Starts full, so a client may burst up to {@code capacity} requests immediately, then
 * refills continuously at {@code capacity} per {@code period}. Continuous rather than
 * fixed-window because a fixed window lets a caller make {@code capacity} requests at the
 * end of one window and {@code capacity} more at the start of the next, which is double the
 * intended rate at exactly the moment it matters.
 *
 * <p>Refill is calculated from elapsed time on access rather than by a scheduled task, so
 * there is no timer per bucket and no cost for buckets nobody touches.
 *
 * <p>Synchronised rather than lock-free: contention is per key, and the work inside is a few
 * arithmetic operations.
 */
final class TokenBucket {

    private final long capacity;
    private final double tokensPerNano;

    private double tokens;
    private long lastRefillNanos;

    /** Volatile because the eviction sweep reads this without holding the lock. */
    private volatile long lastUsedNanos;

    TokenBucket(long capacity, Duration period, long nowNanos) {
        if (capacity < 1) {
            throw new IllegalArgumentException("capacity must be at least 1, was " + capacity);
        }
        if (period == null || period.isZero() || period.isNegative()) {
            throw new IllegalArgumentException("period must be positive, was " + period);
        }
        this.capacity = capacity;
        this.tokensPerNano = (double) capacity / period.toNanos();
        this.tokens = capacity;
        this.lastRefillNanos = nowNanos;
        this.lastUsedNanos = nowNanos;
    }

    /**
     * @return true if a token was available and consumed, false if the caller is over its limit
     */
    synchronized boolean tryConsume(long nowNanos) {
        lastUsedNanos = nowNanos;
        refill(nowNanos);
        if (tokens >= 1.0) {
            tokens -= 1.0;
            return true;
        }
        return false;
    }

    /** How long until a token is available, for the {@code Retry-After} header. */
    synchronized Duration retryAfter(long nowNanos) {
        refill(nowNanos);
        if (tokens >= 1.0) {
            return Duration.ZERO;
        }
        double nanosPerToken = 1.0 / tokensPerNano;
        return Duration.ofNanos((long) Math.ceil((1.0 - tokens) * nanosPerToken));
    }

    long lastUsedNanos() {
        return lastUsedNanos;
    }

    private void refill(long nowNanos) {
        long elapsed = nowNanos - lastRefillNanos;
        if (elapsed <= 0) {
            // Clock went backwards, or two calls in the same nanosecond. Nothing to add.
            return;
        }
        tokens = Math.min(capacity, tokens + elapsed * tokensPerNano);
        lastRefillNanos = nowNanos;
    }
}
