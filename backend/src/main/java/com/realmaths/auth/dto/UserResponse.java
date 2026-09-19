package com.realmaths.auth.dto;

import com.realmaths.user.User;
import java.time.Instant;

public record UserResponse(
        Long id,
        String email,
        String displayName,
        String role,
        int points,
        int currentStreak,
        int bestStreak,
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole().name(),
                user.getPoints(),
                user.getCurrentStreak(),
                user.getBestStreak(),
                user.getCreatedAt());
    }
}
