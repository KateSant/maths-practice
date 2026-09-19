package com.realmaths.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class InMemoryRateLimiterTest {

    private static final long START = 1_000_000_000L;
    private static final Duration ONE_MINUTE = Duration.ofMinutes(1);

    /**
     * The limiter only sweeps once a minute (or when the map is half full), so tests that need a
     * sweep must advance time past that interval rather than just past the idle expiry.
     */
    private static final long PAST_THE_SWEEP_INTERVAL = Duration.ofSeconds(90).toNanos();

    @Test
    void keysAreIndependent() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(100, Duration.ofHours(1));

        assertThat(limiter.tryConsume("a", 1, ONE_MINUTE, START)).isTrue();
        assertThat(limiter.tryConsume("a", 1, ONE_MINUTE, START)).isFalse();
        // A different key has its own bucket.
        assertThat(limiter.tryConsume("b", 1, ONE_MINUTE, START)).isTrue();
    }

    @Test
    void refusesANewKeyWhenTheMapIsFull() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(2, Duration.ofHours(1));

        assertThat(limiter.tryConsume("a", 5, ONE_MINUTE, START)).isTrue();
        assertThat(limiter.tryConsume("b", 5, ONE_MINUTE, START)).isTrue();

        // Full, and nothing is idle enough to reclaim, so a new key is refused rather than
        // admitted. Admitting it would mean evicting an existing bucket, and an attacker could
        // exploit that: push out your own exhausted bucket with a fresh address and the limit
        // resets. Failing closed is the point.
        assertThat(limiter.tryConsume("c", 5, ONE_MINUTE, START)).isFalse();

        // Existing keys are unaffected by the refusal.
        assertThat(limiter.tryConsume("a", 5, ONE_MINUTE, START)).isTrue();
    }

    @Test
    void reclaimsBucketsIdlePastTheExpiry() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(100, Duration.ofSeconds(10));

        limiter.tryConsume("a", 5, ONE_MINUTE, START);
        limiter.tryConsume("b", 5, ONE_MINUTE, START);
        assertThat(limiter.size()).isEqualTo(2);

        // Far past both the idle expiry and the sweep interval, so the stale buckets go.
        limiter.tryConsume("c", 5, ONE_MINUTE, START + PAST_THE_SWEEP_INTERVAL);
        assertThat(limiter.size()).isEqualTo(1);
    }

    @Test
    void keepsBucketsThatAreStillInUse() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(100, Duration.ofSeconds(10));

        limiter.tryConsume("a", 5, ONE_MINUTE, START);
        // "a" is used again shortly before the sweep, so it must survive.
        long almostDue = START + PAST_THE_SWEEP_INTERVAL - Duration.ofSeconds(1).toNanos();
        limiter.tryConsume("a", 5, ONE_MINUTE, almostDue);

        // Adding a new key past the sweep interval triggers the sweep.
        limiter.tryConsume("b", 5, ONE_MINUTE, START + PAST_THE_SWEEP_INTERVAL);

        assertThat(limiter.size()).isEqualTo(2);
    }

    @Test
    void retryAfterIsZeroForAnUnknownKey() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(10, Duration.ofHours(1));
        assertThat(limiter.retryAfter("never-seen", START)).isZero();
    }
}
