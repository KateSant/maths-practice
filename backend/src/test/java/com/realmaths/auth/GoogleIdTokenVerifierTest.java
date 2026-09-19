package com.realmaths.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.realmaths.common.ApiException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * Every check the verifier makes, exercised without touching the network.
 *
 * <p>The JWKS endpoint is the only part not covered: the test supplies a decoder built
 * over a locally generated RSA key, which is what the package-private
 * {@code withDecoder} seam exists for. Claim checking lives in the verifier rather than
 * in decoder validators precisely so that it can be tested like this.
 */
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "1234567890-test.apps.googleusercontent.com";
    /** Both forms are real; Google has issued each at different times. */
    private static final String ISSUER = "https://accounts.google.com";
    private static final String ISSUER_WITHOUT_SCHEME = "accounts.google.com";
    private static final Instant NOW = Instant.now();

    private RSAKey signingKey;
    private RSAKey otherKey;
    private NimbusJwtDecoder decoder;

    @BeforeEach
    void setUp() throws Exception {
        signingKey = new RSAKeyGenerator(2048).keyID("test-key").generate();
        otherKey = new RSAKeyGenerator(2048).keyID("other-key").generate();

        decoder = NimbusJwtDecoder.withPublicKey(signingKey.toRSAPublicKey()).build();
        // Same validator as production, so the expiry check under test is the real one.
        decoder.setJwtValidator(JwtValidators.createDefault());
    }

    // ------------------------------------------------------------- happy paths ---

    @Test
    void acceptsAValidGmailToken() {
        GoogleIdentity identity = verifier(List.of())
                .verify(token(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey));

        assertThat(identity.subject()).isEqualTo("google-subject-1");
        assertThat(identity.email()).isEqualTo("learner@gmail.com");
        assertThat(identity.displayName()).isEqualTo("Ada Lovelace");
        // Google issued the address, so it can vouch for it.
        assertThat(identity.emailAuthoritative()).isTrue();
    }

    @Test
    void acceptsTheIssuerWithoutTheScheme() {
        GoogleIdentity identity = verifier(List.of())
                .verify(token(
                        ISSUER_WITHOUT_SCHEME, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey));

        assertThat(identity.subject()).isEqualTo("google-subject-1");
    }

    @Test
    void acceptsAWorkspaceAccountInAnAllowedDomain() {
        Map<String, Object> claims = claims("teacher@school.example");
        claims.put("hd", "school.example");

        GoogleIdentity identity = verifier(List.of("school.example"))
                .verify(token(ISSUER, List.of(CLIENT_ID), claims, signingKey));

        assertThat(identity.hostedDomain()).isEqualTo("school.example");
        assertThat(identity.emailAuthoritative()).isTrue();
    }

    @Test
    void normalisesTheEmailToLowerCase() {
        GoogleIdentity identity = verifier(List.of())
                .verify(token(ISSUER, List.of(CLIENT_ID), claims("Learner@Gmail.COM"), signingKey));

        assertThat(identity.email()).isEqualTo("learner@gmail.com");
    }

    @Test
    void fallsBackToTheEmailLocalPartWhenThereIsNoNameClaim() {
        Map<String, Object> claims = claims("learner@gmail.com");
        claims.remove("name");

        GoogleIdentity identity =
                verifier(List.of()).verify(token(ISSUER, List.of(CLIENT_ID), claims, signingKey));

        assertThat(identity.displayName()).isEqualTo("learner");
    }

    // ------------------------------------------------------ authority, not just
    // ------------------------------------------------------ verification ---

    /**
     * A Google account can carry an address Google did not issue. Google explicitly
     * does not vouch for ownership of those, which is what stops us linking an
     * identity onto an existing account by email alone.
     */
    @Test
    void treatsAThirdPartyAddressAsNotAuthoritative() {
        GoogleIdentity identity = verifier(List.of())
                .verify(token(ISSUER, List.of(CLIENT_ID), claims("someone@school.example"), signingKey));

        assertThat(identity.emailAuthoritative()).isFalse();
    }

    // --------------------------------------------------------------- rejections ---

    @Test
    void rejectsATokenIssuedForADifferentApplication() {
        String foreign = token(ISSUER, List.of("someone-elses-client-id"), claims("learner@gmail.com"), signingKey);

        assertThatThrownBy(() -> verifier(List.of()).verify(foreign))
                .as("an ID token minted for another app must not be replayable here")
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void rejectsATokenFromAnotherIssuer() {
        String forged = token(
                "https://accounts.google.com.evil.example",
                List.of(CLIENT_ID),
                claims("learner@gmail.com"),
                signingKey);

        assertThatThrownBy(() -> verifier(List.of()).verify(forged)).isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsATokenSignedByTheWrongKey() {
        String wronglySigned = token(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), otherKey);

        assertThatThrownBy(() -> verifier(List.of()).verify(wronglySigned))
                .as("the signature must actually be checked")
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsAnExpiredToken() {
        assertThatThrownBy(() -> verifier(List.of())
                .verify(expiredToken(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsATokenWhoseEmailGoogleHasNotVerified() {
        Map<String, Object> claims = claims("learner@gmail.com");
        claims.put("email_verified", false);

        assertThatThrownBy(() -> verifier(List.of()).verify(token(ISSUER, List.of(CLIENT_ID), claims, signingKey)))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void rejectsATokenWithNoEmail() {
        Map<String, Object> claims = claims("learner@gmail.com");
        claims.remove("email");

        assertThatThrownBy(() -> verifier(List.of()).verify(token(ISSUER, List.of(CLIENT_ID), claims, signingKey)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsATokenWithNoSubject() {
        String noSubject = subjectlessToken(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey);

        assertThatThrownBy(() -> verifier(List.of()).verify(noSubject))
                .as("identity cannot be keyed without a subject")
                .isInstanceOf(ApiException.class);
    }

    @Test
    void refusesAWorkspaceAccountOutsideTheAllowedDomains() {
        Map<String, Object> claims = claims("teacher@elsewhere.example");
        claims.put("hd", "elsewhere.example");

        assertThatThrownBy(() -> verifier(List.of("school.example"))
                .verify(token(ISSUER, List.of(CLIENT_ID), claims, signingKey)))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void refusesAPersonalAccountWhenTheDomainListIsRestrictive() {
        // A gmail.com account has no hd claim at all, so it cannot satisfy a domain list.
        assertThatThrownBy(() -> verifier(List.of("school.example"))
                .verify(token(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey)))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void reportsAMissingClientIdAsUnavailableRatherThanFalllingOpen() {
        GoogleIdTokenVerifier unconfigured = GoogleIdTokenVerifier.forClientId("", List.of());
        String valid = token(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey);

        assertThatThrownBy(() -> unconfigured.verify(valid))
                .as("an unconfigured server must refuse, not skip the audience check")
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void treatsBlankAllowedDomainsAsNoRestriction() {
        // The property default is an empty string, which arrives as [""].
        GoogleIdentity identity = verifier(List.of(""))
                .verify(token(ISSUER, List.of(CLIENT_ID), claims("learner@gmail.com"), signingKey));

        assertThat(identity.email()).isEqualTo("learner@gmail.com");
    }

    // -------------------------------------------------------------- test wiring ---

    private GoogleIdTokenVerifier verifier(List<String> allowedDomains) {
        return GoogleIdTokenVerifier.withDecoder(decoder, Set.of(CLIENT_ID), allowedDomains);
    }

    private static Map<String, Object> claims(String email) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", email);
        claims.put("email_verified", true);
        claims.put("name", "Ada Lovelace");
        return claims;
    }

    private static String token(String issuer, List<String> audience, Map<String, Object> claims, RSAKey key) {
        return token(issuer, audience, claims, key, NOW.minusSeconds(30), NOW.plusSeconds(600), "google-subject-1");
    }

    /** Expired, but with exp still after iat so it is shaped like a real expired token. */
    private static String expiredToken(String issuer, List<String> audience, Map<String, Object> claims, RSAKey key) {
        return token(issuer, audience, claims, key, NOW.minusSeconds(3_600), NOW.minusSeconds(600), "google-subject-1");
    }

    /** No sub claim at all, which must be rejected because identity is keyed on it. */
    private static String subjectlessToken(
            String issuer, List<String> audience, Map<String, Object> claims, RSAKey key) {
        return token(issuer, audience, claims, key, NOW.minusSeconds(30), NOW.plusSeconds(600), null);
    }

    private static String token(
            String issuer,
            List<String> audience,
            Map<String, Object> claims,
            RSAKey key,
            Instant issuedAt,
            Instant expiresAt,
            String subject) {
        JwtClaimsSet.Builder builder = JwtClaimsSet.builder()
                .audience(audience)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt);
        // iss is set as a raw claim on purpose. Spring's typed issuer() converter insists
        // on a URL, and Google issues the scheme-less "accounts.google.com" form too, so
        // the typed setter cannot express a token we have to handle.
        builder.claim(JwtClaimNames.ISS, issuer);
        if (subject != null) {
            builder.subject(subject);
        }
        claims.forEach(builder::claim);

        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(key));
        NimbusJwtEncoder encoder = new NimbusJwtEncoder(jwkSource);
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, builder.build())).getTokenValue();
    }
}
