package com.realmaths.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * All tunable behaviour in one place, bound from the {@code realmaths.*} keys in
 * application.yml. Kept as records so properties are immutable once bound.
 */
@ConfigurationProperties(prefix = "realmaths")
public record RealMathsProperties(Jwt jwt, Cors cors, Quiz quiz, Google google) {

    public record Jwt(String secret, String issuer, Duration ttl) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Quiz(int defaultQuestionCount, int maxQuestionCount, int pointsPerCorrectAnswer) {}

    /**
     * @param clientId the OAuth client ID from Google Cloud. Public, not a secret, but
     *     the ID token's {@code aud} claim is checked against it, so it must match the
     *     value the frontend was built with. Blank disables Google sign-in rather than
     *     failing at startup, so the app still boots without it.
     * @param allowedDomains Google Workspace domains to restrict sign-in to, matched
     *     against the {@code hd} claim. Empty means any Google account.
     */
    public record Google(String clientId, List<String> allowedDomains) {}
}
