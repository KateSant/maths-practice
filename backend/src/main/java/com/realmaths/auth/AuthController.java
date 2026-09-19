package com.realmaths.auth;

import com.realmaths.auth.dto.AuthResponse;
import com.realmaths.auth.dto.GoogleSignInRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Both endpoints are open ({@code /api/auth/**} is permitted in SecurityConfig) and
 * return one of our own JWTs. There is no password endpoint by design.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/google")
    public AuthResponse signInWithGoogle(@Valid @RequestBody GoogleSignInRequest request) {
        return authService.signInWithGoogle(request.idToken());
    }

    @PostMapping("/guest")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse continueAsGuest() {
        return authService.continueAsGuest();
    }
}
