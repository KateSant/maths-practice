package com.realmaths.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class TokenBucketTest {

    private static final Duration ONE_MINUTE = Duration.ofMinutes(1);
    private static final long START = 1_000_000_000L;

    @Test
    void allowsABurstUpToCapacityThenRefuses() {
        TokenBucket bucket = new TokenBucket(3, ONE_MINUTE, START);
        assertThat(bucket.tryConsume(START)).isTrue();
        assertThat(bucket.tryConsume(START)).isTrue();
        assertThat(bucket.tryConsume(START)).isTrue();
        assertThat(bucket.tryConsume(START)).isFalse();
    }

    @Test
    void refillsContinuously() {
        // 60 per minute is one per second.
        TokenBucket bucket = new TokenBucket(60, ONE_MINUTE, START);
        for (int i = 0; i < 60; i++) {
            assertThat(bucket.tryConsume(START)).isTrue();
        }
        assertThat(bucket.tryConsume(START)).isFalse();

        // Half a second is not yet a whole token.
        assertThat(bucket.tryConsume(START + Duration.ofMillis(500).toNanos())).isFalse();
        // A full second is.
        assertThat(bucket.tryConsume(START + Duration.ofSeconds(1).toNanos())).isTrue();
    }

    @Test
    void neverAccumulatesBeyondCapacity() {
        TokenBucket bucket = new TokenBucket(2, ONE_MINUTE, START);
        bucket.tryConsume(START);
        bucket.tryConsume(START);

        long muchLater = START + Duration.ofHours(1).toNanos();
        assertThat(bucket.tryConsume(muchLater)).isTrue();
        assertThat(bucket.tryConsume(muchLater)).isTrue();
        // Only two were ever available, no matter how long it sat idle.
        assertThat(bucket.tryConsume(muchLater)).isFalse();
    }

    @Test
    void reportsHowLongUntilATokenIsAvailable() {
        TokenBucket bucket = new TokenBucket(60, ONE_MINUTE, START);
        for (int i = 0; i < 60; i++) {
            bucket.tryConsume(START);
        }
        assertThat(bucket.retryAfter(START)).isBetween(Duration.ofMillis(900), Duration.ofSeconds(1));
        assertThat(bucket.retryAfter(START + Duration.ofSeconds(2).toNanos())).isZero();
    }

    @Test
    void aClockJumpingBackwardsDoesNotMintTokens() {
        TokenBucket bucket = new TokenBucket(1, ONE_MINUTE, START);
        assertThat(bucket.tryConsume(START)).isTrue();
        // System.nanoTime is monotonic, but a test harness or a stub could misbehave, and the
        // safe response is to grant nothing rather than to refill.
        assertThat(bucket.tryConsume(START - Duration.ofSeconds(30).toNanos())).isFalse();
    }

    @Test
    void rejectsNonsenseConfiguration() {
        assertThatThrownBy(() -> new TokenBucket(0, ONE_MINUTE, START)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TokenBucket(1, Duration.ZERO, START)).isInstanceOf(IllegalArgumentException.class);
    }
}
