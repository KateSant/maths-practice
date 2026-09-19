package com.realmaths.auth;

import com.realmaths.config.RealMathsProperties;
import com.realmaths.user.User;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

/** Issues the short-lived HS256 access tokens handed to the frontend on login. */
@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final RealMathsProperties properties;
    private final Clock clock;

    public JwtService(JwtEncoder jwtEncoder, RealMathsProperties properties, Clock clock) {
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
        this.clock = clock;
    }

    public IssuedToken issueFor(User user) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plus(properties.jwt().ttl());

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.jwt().issuer())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("name", user.getDisplayName())
                // NOT used for authorisation, and must not be: it is stale the moment a
                // role changes, whereas JwtToUserPrincipalConverter re-reads the user
                // row on every request and builds authorities from that. Kept only as a
                // convenience for the browser. Note also that once an identity provider
                // is involved, "scope" is a name it may want for itself.
                .claim("scope", user.getRole().name())
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public record IssuedToken(String token, Instant expiresAt) {}
}
