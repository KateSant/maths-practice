package com.realmaths.auth.dto;

import com.realmaths.user.User;
import java.time.Instant;
import java.time.LocalDate;

public record UserResponse(
        Long id,
        String email,
        String displayName,
        String role,
        int points,
        /** Weeks practised in a row. Reads as zero once a whole week has gone by with nothing. */
        int streakWeeks,
        int bestStreakWeeks,
        Instant createdAt) {

    /**
     * @param today the student's today, so a lapsed streak can be reported as zero rather than as
     *     whatever it last reached. See {@link com.realmaths.user.WeeklyStreak}.
     */
    public static UserResponse from(User user, LocalDate today) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole().name(),
                user.getPoints(),
                user.streakWeeksAsOf(today),
                user.getBestStreakWeeks(),
                user.getCreatedAt());
    }
}
