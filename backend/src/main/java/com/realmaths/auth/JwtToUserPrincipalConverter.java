package com.realmaths.auth;

import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Turns a verified JWT into an authenticated principal by loading the current user
 * row. Hitting the database per request buys us two things: a deleted account stops
 * working immediately, and controllers get a typed {@link UserPrincipal}.
 *
 * At prototype traffic this is free. If it ever matters, cache the lookup or trust
 * the claims in the token instead.
 */
@Component
public class JwtToUserPrincipalConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserRepository userRepository;

    public JwtToUserPrincipalConverter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Long userId;
        try {
            userId = Long.valueOf(jwt.getSubject());
        } catch (NumberFormatException ex) {
            throw new BadCredentialsException("Malformed token subject.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadCredentialsException("This account no longer exists."));

        List<SimpleGrantedAuthority> authorities =
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        return new UsernamePasswordAuthenticationToken(UserPrincipal.from(user), jwt.getTokenValue(), authorities);
    }
}
