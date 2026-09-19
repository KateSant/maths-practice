package com.realmaths.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        // 8 is a floor for a prototype; bcrypt ignores anything past 72 bytes.
        @NotBlank @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters.") String password,
        @NotBlank @Size(max = 80) String displayName) {}
