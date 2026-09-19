package com.realmaths.auth;

import com.realmaths.common.ApiException;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Verifies a Google ID token and extracts the identity from it.
 *
 * <p>Google's checklist, implemented literally: the signature must be Google's, the
 * audience must be our own client ID, the issuer must be Google, the token must not
 * have expired, and the email must be verified.
 *
 * <p><strong>The decoder here is a private field, not a Spring bean, and that is
 * deliberate.</strong> {@code SecurityConfig} authenticates API calls with the single
 * {@code JwtDecoder} bean from {@link com.realmaths.config.JwtConfig}. If this decoder
 * were also a bean, the resource server could be wired to Google's keys — at which
 * point any Google ID token would be accepted as an API credential. Keeping it off the
 * application context makes that impossible rather than merely unlikely.
 *
 * <p>Signature and lifetime are delegated to the decoder; issuer, audience and
 * {@code email_verified} are checked here in plain code. That split is for
 * testability: it means every check below runs in tests that supply a decoder built
 * over a locally generated key set, with no network access.
 */
public final class GoogleIdTokenVerifier {

    /** Google's published signing keys. Rotated regularly; Nimbus caches them. */
    static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";

    /**
     * Google issues the issuer claim in both forms. Checking only one is an easy
     * mistake that every locally written test still passes.
     */
    private static final Set<String> VALID_ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    private static final String GMAIL_SUFFIX = "@gmail.com";
    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_EMAIL_VERIFIED = "email_verified";
    private static final String CLAIM_HOSTED_DOMAIN = "hd";
    private static final String CLAIM_NAME = "name";

    private final JwtDecoder decoder;
    private final Set<String> acceptedClientIds;
    private final List<String> allowedDomains;

    private GoogleIdTokenVerifier(JwtDecoder decoder, Set<String> acceptedClientIds, List<String> allowedDomains) {
        this.decoder = decoder;
        this.acceptedClientIds = Set.copyOf(acceptedClientIds);
        // Blank entries are possible when the property is supplied as an empty string,
        // which is the documented default, so they are filtered rather than trusted.
        this.allowedDomains = allowedDomains.stream()
                .filter(domain -> !domain.isBlank())
                .map(domain -> domain.trim().toLowerCase(Locale.ROOT))
                .toList();
    }

    /** Production wiring: talks to Google's JWKS endpoint. */
    public static GoogleIdTokenVerifier forClientId(String clientId, List<String> allowedDomains) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).build();
        // Signature, expiry and not-before only. Everything else is checked in verify().
        decoder.setJwtValidator(JwtValidators.createDefault());

        Set<String> clientIds = clientId == null || clientId.isBlank() ? Set.of() : Set.of(clientId.trim());
        return new GoogleIdTokenVerifier(decoder, clientIds, allowedDomains == null ? List.of() : allowedDomains);
    }

    /**
     * Test seam, intentionally package-private: lets a test supply a decoder backed by
     * a locally generated key set so no test touches the network.
     */
    static GoogleIdTokenVerifier withDecoder(
            JwtDecoder decoder, Set<String> acceptedClientIds, List<String> allowedDomains) {
        return new GoogleIdTokenVerifier(decoder, acceptedClientIds, allowedDomains);
    }

    /**
     * @return the verified identity
     * @throws ApiException 503 if sign-in is not configured, 401 if the token is not a
     *     valid Google token for this application, 403 if it is valid but not acceptable
     */
    public GoogleIdentity verify(String idToken) {
        if (acceptedClientIds.isEmpty()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in is not configured on this server.");
        }

        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException | IllegalArgumentException ex) {
            throw notVerified();
        }

        // Read the raw claim rather than jwt.getIssuer(). Spring models the issuer as a
        // URI, and Google issues the scheme-less form ("accounts.google.com") as well as
        // the URL form, so going through getIssuer() would reject real Google tokens.
        String issuer = jwt.getClaimAsString(JwtClaimNames.ISS);
        if (issuer == null || !VALID_ISSUERS.contains(issuer)) {
            throw notVerified();
        }

        // Without this check an ID token minted for any other application could be
        // replayed here, which is the entire reason the audience check exists.
        if (Collections.disjoint(jwt.getAudience(), acceptedClientIds)) {
            throw notVerified();
        }

        String email = jwt.getClaimAsString(CLAIM_EMAIL);
        Boolean emailVerified = readBoolean(jwt.getClaim(CLAIM_EMAIL_VERIFIED));
        if (email == null || email.isBlank() || !Boolean.TRUE.equals(emailVerified)) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Google has not verified the email address on that account.");
        }

        String hostedDomain = jwt.getClaimAsString(CLAIM_HOSTED_DOMAIN);
        if (!allowedDomains.isEmpty()
                && (hostedDomain == null || !allowedDomains.contains(hostedDomain.toLowerCase(Locale.ROOT)))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sign-in is limited to certain organisations.");
        }

        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            // Cannot key an identity without it, so this is a rejection, not a default.
            throw notVerified();
        }

        String normalisedEmail = email.trim().toLowerCase(Locale.ROOT);
        return new GoogleIdentity(
                subject,
                normalisedEmail,
                displayName(jwt, normalisedEmail),
                hostedDomain,
                isAuthoritative(normalisedEmail, hostedDomain));
    }

    /**
     * Google vouches for an address when it issued it ({@code @gmail.com}) or when the
     * account is managed by a Workspace domain. Anything else, Google is only relaying
     * a third-party address it does not control.
     */
    private static boolean isAuthoritative(String email, String hostedDomain) {
        return email.endsWith(GMAIL_SUFFIX) || (hostedDomain != null && !hostedDomain.isBlank());
    }

    private static String displayName(Jwt jwt, String fallbackEmail) {
        String name = jwt.getClaimAsString(CLAIM_NAME);
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        // Not every Google account has a profile name set. The local part of the
        // address is a better placeholder than an empty display name.
        int at = fallbackEmail.indexOf('@');
        return at > 0 ? fallbackEmail.substring(0, at) : fallbackEmail;
    }

    /**
     * {@code email_verified} is a JSON boolean in ID tokens, but a string in the
     * tokeninfo endpoint's response, and Nimbus hands back whatever was in the payload.
     */
    private static Boolean readBoolean(Object claim) {
        if (claim instanceof Boolean value) {
            return value;
        }
        if (claim instanceof String value) {
            return Boolean.valueOf(value.trim());
        }
        return null;
    }

    /** One message for every rejection, so a caller cannot probe which check failed. */
    private static ApiException notVerified() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "We could not verify that Google sign-in. Please try again.");
    }
}
