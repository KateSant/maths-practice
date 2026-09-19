package com.realmaths.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.realmaths.ratelimit.RateLimitProperties.Rule;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

    // Production injects Spring Boot's ObjectMapper, which already has the JSR-310 module that
    // ApiError's Instant needs. Registering it here only makes the bare mapper usable in tests.
    private static final ObjectMapper MAPPER = new ObjectMapper().registerModule(new JavaTimeModule());
    private static final Duration ONE_MINUTE = Duration.ofMinutes(1);

    private long now = 1_000_000_000L;

    private final RateLimitProperties properties = new RateLimitProperties(
            true,
            100,
            Duration.ofHours(1),
            List.of(new Rule("guest", "/api/auth/guest", "POST", 2, ONE_MINUTE)),
            new Rule("default", "/api/**", null, 100, ONE_MINUTE));

    private final InMemoryRateLimiter limiter = new InMemoryRateLimiter(properties.maxKeys(), properties.idleExpiry());

    private final RateLimitFilter filter = new RateLimitFilter(properties, limiter, MAPPER, () -> now);

    private MockHttpServletResponse call(String method, String uri, String remoteAddr) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr(remoteAddr);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> { });
        return response;
    }

    @Test
    void allowsRequestsUpToTheLimit() throws Exception {
        assertThat(call("POST", "/api/auth/guest", "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(call("POST", "/api/auth/guest", "1.1.1.1").getStatus()).isEqualTo(200);
    }

    @Test
    void rejectsOnceTheLimitIsExhausted() throws Exception {
        call("POST", "/api/auth/guest", "1.1.1.1");
        call("POST", "/api/auth/guest", "1.1.1.1");

        MockHttpServletResponse response = call("POST", "/api/auth/guest", "1.1.1.1");

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isNotNull();
    }

    @Test
    void differentClientsHaveSeparateLimits() throws Exception {
        call("POST", "/api/auth/guest", "1.1.1.1");
        call("POST", "/api/auth/guest", "1.1.1.1");

        // The first client is now exhausted, but a different address is unaffected.
        assertThat(call("POST", "/api/auth/guest", "2.2.2.2").getStatus()).isEqualTo(200);
    }

    @Test
    void aDifferentMethodOnTheSamePathUsesTheFallbackRule() throws Exception {
        // The guest rule is POST-only, so a GET falls through to the generous fallback.
        call("POST", "/api/auth/guest", "1.1.1.1");
        call("POST", "/api/auth/guest", "1.1.1.1");
        assertThat(call("GET", "/api/auth/guest", "1.1.1.1").getStatus()).isEqualTo(200);
    }

    @Test
    void returnsTheStandardErrorBody() throws Exception {
        call("POST", "/api/auth/guest", "1.1.1.1");
        call("POST", "/api/auth/guest", "1.1.1.1");

        JsonNode body = MAPPER.readTree(call("POST", "/api/auth/guest", "1.1.1.1").getContentAsString());

        assertThat(body.get("status").asInt()).isEqualTo(429);
        assertThat(body.get("message").asText()).contains("Too many requests");
    }

    @Test
    void aRejectedClientIsAllowedAgainOnceATokenRefills() throws Exception {
        call("POST", "/api/auth/guest", "1.1.1.1");
        call("POST", "/api/auth/guest", "1.1.1.1");
        assertThat(call("POST", "/api/auth/guest", "1.1.1.1").getStatus()).isEqualTo(429);

        // Two per minute is one token every 30 seconds.
        now += Duration.ofSeconds(31).toNanos();
        assertThat(call("POST", "/api/auth/guest", "1.1.1.1").getStatus()).isEqualTo(200);
    }

    @Test
    void leavesNonApiPathsAlone() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertThat(call("GET", "/actuator/health", "1.1.1.1").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void doesNotThrottleCorsPreflight() throws Exception {
        // Preflight is cheap and refusing it produces a confusing browser error, so it is never
        // counted even on a path that is otherwise tightly limited.
        for (int i = 0; i < 5; i++) {
            assertThat(call("OPTIONS", "/api/auth/guest", "1.1.1.1").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void canBeSwitchedOffEntirely() throws Exception {
        RateLimitProperties off = new RateLimitProperties(
                false,
                100,
                Duration.ofHours(1),
                List.of(new Rule("guest", "/api/auth/guest", "POST", 1, ONE_MINUTE)),
                new Rule("default", "/api/**", null, 100, ONE_MINUTE));
        RateLimitFilter disabled =
                new RateLimitFilter(off, new InMemoryRateLimiter(100, Duration.ofHours(1)), MAPPER, () -> now);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/guest");
            request.setRemoteAddr("1.1.1.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            disabled.doFilter(request, response, (req, res) -> { });
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }
}
