package com.realmaths.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Carries the Google ID token that Google Identity Services handed to the browser.
 * It is a short-lived, Google-signed JWT; nothing in it is trusted until
 * {@link com.realmaths.auth.GoogleIdTokenVerifier} has checked it.
 */
public record GoogleSignInRequest(@NotBlank(message = "Missing Google credential.") String idToken) {}
