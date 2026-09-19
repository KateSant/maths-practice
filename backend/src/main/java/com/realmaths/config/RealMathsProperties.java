package com.realmaths.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * All tunable behaviour in one place, bound from the {@code realmaths.*} keys in
 * application.yml. Kept as records so properties are immutable once bound.
 */
@ConfigurationProperties(prefix = "realmaths")
public record RealMathsProperties(Jwt jwt, Cors cors, Quiz quiz) {

    public record Jwt(String secret, String issuer, Duration ttl) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Quiz(int defaultQuestionCount, int maxQuestionCount, int pointsPerCorrectAnswer) {}
}
