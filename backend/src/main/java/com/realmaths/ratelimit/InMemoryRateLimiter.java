package com.realmaths.ratelimit;

import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Per-key token buckets held in memory.
 *
 * <p><strong>Deliberately bounded.</strong> A map keyed by client is itself an attack surface:
 * an attacker with a large address pool would otherwise add one entry per address until the
 * JVM ran out of heap, turning a rate limiter into the denial of service. So the map has a hard
 * ceiling, and when it is full a <em>new</em> key is refused rather than admitted.
 *
 * <p>Refusing new keys matters. Evicting the oldest entry to make room would let an attacker
 * push out their own exhausted bucket simply by sending more requests from fresh addresses,
 * resetting the limit they were meant to be held to. Refusing instead means the attack fails
 * closed, which is the correct direction for a safety control.
 *
 * <p>In-memory and single-instance by design: restarting the app resets every counter, and with
 * more than one instance each would enforce its own limits. Both are fine for one box, and both
 * would need a shared store (Redis) if this ever ran replicated.
 */
public class InMemoryRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(InMemoryRateLimiter.class);

    private static final Duration SWEEP_INTERVAL = Duration.ofMinutes(1);

    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final int maxBuckets;
    private final long idleExpiryNanos;

    private final AtomicBoolean sweeping = new AtomicBoolean(false);
    private volatile long lastSweepNanos;

    public InMemoryRateLimiter(int maxBuckets, Duration idleExpiry) {
        this.maxBuckets = maxBuckets;
        this.idleExpiryNanos = idleExpiry.toNanos();
    }

    /**
     * @return true if the key is within its limit, false if it has exhausted the bucket or the
     *     limiter is full and this is a key it has not seen before
     */
    public boolean tryConsume(String key, int capacity, Duration period, long nowNanos) {
        TokenBucket bucket = buckets.get(key);

        if (bucket == null) {
            maybeSweep(nowNanos);
            if (buckets.size() >= maxBuckets) {
                // Full of active keys. Fail closed rather than evicting, see the class comment.
                log.warn("Rate limiter at capacity ({} keys); refusing new key", maxBuckets);
                return false;
            }
            bucket = buckets.computeIfAbsent(key, k -> new TokenBucket(capacity, period, nowNanos));
        }

        return bucket.tryConsume(nowNanos);
    }

    /** Time until the key may retry, or zero if it is not currently limited. */
    public Duration retryAfter(String key, long nowNanos) {
        TokenBucket bucket = buckets.get(key);
        return bucket == null ? Duration.ZERO : bucket.retryAfter(nowNanos);
    }

    /** Visible for tests. */
    public int size() {
        return buckets.size();
    }

    /**
     * Drops buckets nobody has touched for a while, so ordinary churn through many client
     * addresses does not fill the map permanently. Rate-limited from the caller rather than
     * scheduled, to avoid a background task for something this small.
     */
    private void maybeSweep(long nowNanos) {
        if (buckets.size() < maxBuckets / 2 && nowNanos - lastSweepNanos < SWEEP_INTERVAL.toNanos()) {
            return;
        }
        if (!sweeping.compareAndSet(false, true)) {
            return; // another thread is already sweeping
        }
        try {
            buckets.entrySet().removeIf(entry -> nowNanos - entry.getValue().lastUsedNanos() > idleExpiryNanos);
            lastSweepNanos = nowNanos;
        } finally {
            sweeping.set(false);
        }
    }

    /**
     * Only used by tests to prove the ceiling holds. Removes the least recently used entries
     * down to {@code targetSize}.
     */
    void trimTo(int targetSize) {
        if (buckets.size() <= targetSize) {
            return;
        }
        List<Map.Entry<String, TokenBucket>> byAge = buckets.entrySet().stream()
                .sorted(Comparator.comparingLong(e -> e.getValue().lastUsedNanos()))
                .toList();
        int toRemove = byAge.size() - targetSize;
        for (int i = 0; i < toRemove; i++) {
            buckets.remove(byAge.get(i).getKey());
        }
    }
}
