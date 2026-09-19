package com.realmaths.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class RateLimitConfig {

    @Bean
    public InMemoryRateLimiter rateLimiter(RateLimitProperties properties) {
        return new InMemoryRateLimiter(properties.maxKeys(), properties.idleExpiry());
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilter(
            RateLimitProperties properties, InMemoryRateLimiter limiter, ObjectMapper objectMapper) {

        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(
                new RateLimitFilter(properties, limiter, objectMapper, System::nanoTime));

        // Must run after Spring Boot's ForwardedHeaderFilter, which is registered at
        // HIGHEST_PRECEDENCE when server.forward-headers-strategy=framework. The limiter keys
        // on the client address, and getRemoteAddr() only reflects the real caller once
        // X-Forwarded-For has been applied - otherwise every request shares one bucket.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        registration.addUrlPatterns("/api/*");
        return registration;
    }
}
