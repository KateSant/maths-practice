package com.realmaths.auth;

import com.realmaths.auth.dto.AuthResponse;
import com.realmaths.auth.dto.LoginRequest;
import com.realmaths.auth.dto.RegisterRequest;
import com.realmaths.auth.dto.UserResponse;
import com.realmaths.common.ApiException;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.util.Locale;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * A real bcrypt hash of a throwaway value, compared against when the email is
     * unknown so that "no such account" and "wrong password" take the same time and
     * return the same message. Prevents trivial account enumeration.
     */
    private final String dummyHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.dummyHash = passwordEncoder.encode("not-a-real-password");
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with that email already exists.");
        }

        User user = new User(email, passwordEncoder.encode(request.password()), request.displayName().trim());
        return respondWith(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);

        String hashToCheck = user != null ? user.getPasswordHash() : dummyHash;
        boolean passwordMatches = passwordEncoder.matches(request.password(), hashToCheck);

        if (user == null || !passwordMatches) {
            throw new BadCredentialsException("Email or password is incorrect.");
        }
        return respondWith(user);
    }

    private AuthResponse respondWith(User user) {
        JwtService.IssuedToken issued = jwtService.issueFor(user);
        return new AuthResponse(issued.token(), issued.expiresAt(), UserResponse.from(user));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
