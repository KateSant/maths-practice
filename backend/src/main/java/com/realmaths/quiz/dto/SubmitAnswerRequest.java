package com.realmaths.quiz.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SubmitAnswerRequest(
        @NotNull Long questionId,
        @NotNull Long optionId,
        /** How long the student took, for future analytics. Optional. */
        @Min(0) @Max(3_600_000) Integer timeMs) {}
