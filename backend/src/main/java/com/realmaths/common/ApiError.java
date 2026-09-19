package com.realmaths.common;

import java.time.Instant;
import java.util.Map;

/**
 * Consistent error body for every failure the API returns, so the frontend can
 * always render {@code message} and, for validation errors, {@code fieldErrors}.
 */
public record ApiError(Instant timestamp, int status, String message, Map<String, String> fieldErrors) {

    public static ApiError of(int status, String message) {
        return new ApiError(Instant.now(), status, message, Map.of());
    }

    public static ApiError validation(String message, Map<String, String> fieldErrors) {
        return new ApiError(Instant.now(), 400, message, fieldErrors);
    }
}
