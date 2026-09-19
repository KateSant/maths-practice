package com.realmaths.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.realmaths.common.ApiError;
import com.realmaths.ratelimit.RateLimitProperties.Rule;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.LongSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.server.PathContainer;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

/**
 * Applies per-client request limits to the API.
 *
 * <p>Keys on the client address, so it depends on
 * {@code server.forward-headers-strategy=framework} being set. The API container publishes no
 * ports and is reachable only from Caddy, so {@code X-Forwarded-For} can only have come from
 * Caddy — but without that setting Spring ignores the header and every request looks like it
 * arrives from the Docker network. That failure mode is worth knowing: all users would share
 * one bucket and get throttled together, which reads as "the site is broken sometimes".
 *
 * <p>Path patterns are compiled once at construction rather than per request.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    // Declared rather than using the inherited `logger`, which is commons-logging and only
    // supports a single-argument debug call.
    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final PathPatternParser PATTERN_PARSER = PathPatternParser.defaultInstance;

    /** Only API paths are limited; static assets are served by Caddy and never reach Spring. */
    private static final String LIMITED_PREFIX = "/api/";

    private final RateLimitProperties properties;
    private final InMemoryRateLimiter limiter;
    private final ObjectMapper objectMapper;
    private final LongSupplier nanoTime;
    private final List<CompiledRule> rules;
    private final CompiledRule fallback;

    public RateLimitFilter(
            RateLimitProperties properties,
            InMemoryRateLimiter limiter,
            ObjectMapper objectMapper,
            LongSupplier nanoTime) {
        this.properties = properties;
        this.limiter = limiter;
        this.objectMapper = objectMapper;
        this.nanoTime = nanoTime;
        this.rules = compile(properties.rules());
        this.fallback = new CompiledRule(properties.fallback());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.on()) {
            return true;
        }
        if (!request.getRequestURI().startsWith(LIMITED_PREFIX)) {
            return true;
        }
        // A CORS preflight is cheap and must never be throttled: refusing it produces a
        // confusing browser error instead of a clear one, and it is not work worth limiting.
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        CompiledRule rule = ruleFor(request);
        String key = rule.rule().name() + '|' + clientAddress(request);
        long now = nanoTime.getAsLong();

        if (!limiter.tryConsume(key, rule.rule().requests(), rule.rule().period(), now)) {
            Duration retryAfter = limiter.retryAfter(key, now);
            // Logged at debug deliberately. Under a flood, a warning per rejected request is
            // itself a way to fill the log, and Caddy is already recording the requests.
            log.debug("Rate limit hit: rule={} path={} retryAfter={}s",
                    rule.rule().name(), request.getRequestURI(), retryAfter.toSeconds());
            reject(response, retryAfter);
            return;
        }

        chain.doFilter(request, response);
    }

    private CompiledRule ruleFor(HttpServletRequest request) {
        String path = request.getRequestURI();
        for (CompiledRule candidate : rules) {
            if (candidate.matches(path, request.getMethod())) {
                return candidate;
            }
        }
        return fallback;
    }

    /**
     * The caller's address, as rewritten by Spring's ForwardedHeaderFilter. Falls back to a
     * constant rather than throwing: an unidentifiable caller should still be limited, and all
     * such callers sharing one bucket is the safe direction to fail.
     */
    private static String clientAddress(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        return (remote == null || remote.isBlank()) ? "unknown" : remote;
    }

    private void reject(HttpServletResponse response, Duration retryAfter) {
        long seconds = Math.max(1, retryAfter.toSeconds());
        response.setStatus(429);
        response.setHeader("Retry-After", Long.toString(seconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        try {
            objectMapper.writeValue(
                    response.getOutputStream(),
                    ApiError.of(429, "Too many requests. Please wait a moment and try again."));
        } catch (IOException e) {
            // Status and Retry-After are already set, so the client is told to back off either
            // way. A limiter that turns into a 500 under load would be worse than one that
            // returns 429 with an empty body.
            log.debug("Could not write the 429 response body", e);
        }
    }

    private static List<CompiledRule> compile(List<Rule> rules) {
        List<CompiledRule> compiled = new ArrayList<>(rules.size());
        for (Rule rule : rules) {
            compiled.add(new CompiledRule(rule));
        }
        return List.copyOf(compiled);
    }

    private record CompiledRule(Rule rule, PathPattern pattern) {

        CompiledRule(Rule rule) {
            this(rule, PATTERN_PARSER.parse(rule.path()));
        }

        boolean matches(String path, String method) {
            return rule.matchesMethod(method) && pattern.matches(PathContainer.parsePath(path));
        }
    }
}
