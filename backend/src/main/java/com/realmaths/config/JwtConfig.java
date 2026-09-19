package com.realmaths.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.realmaths.auth.JwtService;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * Signing and verification of our own access tokens, using Spring Security's
 * Nimbus integration so we avoid a third-party JWT dependency.
 */
@Configuration
public class JwtConfig {

    /** HS256 needs at least 256 bits of key material. */
    private static final int MIN_SECRET_BYTES = 32;

    @Bean
    public JwtEncoder jwtEncoder(RealMathsProperties properties) {
        // Spring Security 6.5's NimbusJwtEncoder only takes a JWKSource, so wrap our
        // symmetric key with Nimbus' ImmutableSecret. The HS256 algorithm comes from
        // the JwsHeader set in JwtService.
        JWKSource<SecurityContext> jwkSource = new ImmutableSecret<>(signingKey(properties));
        return new NimbusJwtEncoder(jwkSource);
    }

    @Bean
    public JwtDecoder jwtDecoder(RealMathsProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(signingKey(properties))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        // Rejects tokens with the wrong issuer, in addition to the default expiry check.
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.jwt().issuer()));
        return decoder;
    }

    private static SecretKey signingKey(RealMathsProperties properties) {
        String secret = properties.jwt().secret();
        byte[] bytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "realmaths.jwt.secret must be at least " + MIN_SECRET_BYTES
                            + " bytes (was " + bytes.length + "). Set the REALMATHS_JWT_SECRET environment variable.");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }
}
