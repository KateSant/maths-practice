package com.realmaths.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    /** Injected rather than calling Instant.now() directly, so tests can control time. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
