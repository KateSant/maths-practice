package com.realmaths.config;

import com.realmaths.auth.GoogleIdTokenVerifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the Google ID token verifier.
 *
 * <p>Note what is <em>not</em> here: the verifier builds its own {@code JwtDecoder}
 * internally and never publishes one. Registering it as a bean would put a second
 * {@code JwtDecoder} in the context alongside the one that authenticates our own API
 * tokens, and the resource server could then be wired to Google's keys — making any
 * Google ID token a valid API credential.
 */
@Configuration
public class GoogleConfig {

    @Bean
    public GoogleIdTokenVerifier googleIdTokenVerifier(RealMathsProperties properties) {
        return GoogleIdTokenVerifier.forClientId(
                properties.google().clientId(), properties.google().allowedDomains());
    }
}
