package com.realmaths.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class InMemoryRateLimiterTest {

    private static final long START = 1_000_000_000L;
    private static final Duration ONE_MINUTE = Duration.ofMinutes(1);

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
        // admitted. Admitting it would mean evicting an existing bucket, which would let an
        // attacker reset their own exhausted limit simply by using a fresh address.
        assertThat(limiter.tryConsume("c", 5, ONE_MINUTE, START)).isFalse();

        // Existing keys are unaffected.
        assertThat(limiter.tryConsume("a", 5, ONE_MINUTE, START)).isTrue();
    }

    @Test
    void reclaimsBucketsThatHaveBeenIdlePastTheExpiry() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(100, Duration.ofSeconds(10));

        limiter.tryConsume("a", 5, ONE_MINUTE, START);
        limiter.tryConsume("b", 5, ONE_MINUTE, START);
        assertThat(limiter.size()).isEqualTo(2);

        // Well past the idle expiry, so the sweep reclaims the two stale buckets.
        limiter.tryConsume("c", 5, ONE_MINUTE, START + Duration.ofSeconds(30).toNanos());
        assertThat(limiter.size()).isEqualTo(1);
    }

    @Test
    void keepsBucketsThatAreStillBeingUsed() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(100, Duration.ofSeconds(10));

        limiter.tryConsume("a", 5, ONE_MINUTE, START);
        // Used again before the idle expiry, so it must survive a sweep triggered by a new key.
        limiter.tryConsume("a", 5, ONE_MINUTE, START + Duration.ofSeconds(5).toNanos());
        limiter.tryConsume("b", 5, ONE_MINUTE, START + Duration.ofSeconds(11).toNanos());

        assertThat(limiter.size()).isEqualTo(2);
    }

    @Test
    void retryAfterIsZeroForAnUnknownKey() {
        InMemoryRateLimiter limiter = new InMemoryRateLimiter(10, Duration.ofHours(1));
        assertThat(limiter.retryAfter("never-seen", START)).isZero();
    }
}
