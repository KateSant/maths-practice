package com.realmaths.ratelimit;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Rate limiting configuration, bound from {@code realmaths.rate-limit.*}.
 *
 * <p>Defaults live here as well as in application.yml so that a missing or empty config block
 * still leaves the limiter doing something sensible. The specific per-endpoint limits are
 * deliberately <em>not</em> duplicated here: they belong in configuration, and the fallback
 * below is a safety net rather than a second source of truth.
 */
@ConfigurationProperties(prefix = "realmaths.rate-limit")
public record RateLimitProperties(
        Boolean enabled, Integer maxKeys, Duration idleExpiry, List<Rule> rules, Rule fallback) {

    /** Ceiling on distinct keys held in memory. See {@link InMemoryRateLimiter} for why. */
    private static final int DEFAULT_MAX_KEYS = 10_000;

    private static final Duration DEFAULT_IDLE_EXPIRY = Duration.ofHours(1);

    private static final Rule DEFAULT_FALLBACK = new Rule("default", "/api/**", null, 600, Duration.ofMinutes(1));

    public RateLimitProperties {
        if (enabled == null) {
            enabled = true;
        }
        if (maxKeys == null || maxKeys < 1) {
            maxKeys = DEFAULT_MAX_KEYS;
        }
        if (idleExpiry == null || idleExpiry.isZero() || idleExpiry.isNegative()) {
            idleExpiry = DEFAULT_IDLE_EXPIRY;
        }
        if (rules == null) {
            rules = List.of();
        }
        if (fallback == null) {
            fallback = DEFAULT_FALLBACK;
        }
    }

    /** Named so callers get a primitive; the compact constructor guarantees it is never null. */
    public boolean on() {
        return enabled;
    }

    /**
     * @param name label used in the bucket key and in logs, e.g. "guest"
     * @param path request path pattern, matched with Spring's PathPattern syntax
     * @param method HTTP method to match, or null for any
     * @param requests bucket capacity, i.e. the burst size
     * @param period time over which that many requests are permitted
     */
    public record Rule(String name, String path, String method, int requests, Duration period) {

        public boolean matchesMethod(String requestMethod) {
            return method == null || method.isBlank() || method.equalsIgnoreCase(requestMethod);
        }
    }
}
