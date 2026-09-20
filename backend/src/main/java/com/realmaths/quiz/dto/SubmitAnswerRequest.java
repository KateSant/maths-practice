package com.realmaths.quiz.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * One committed answer.
 *
 * <p>The two selection fields are an either/or, chosen by the question's answer type:
 * {@code optionId} for a single choice, {@code optionIds} for a tick-all. Only one is ever read,
 * and which one depends on the question rather than on the request, so a client cannot change how
 * its answer is graded by sending the other field.
 *
 * <p>Neither is {@code @NotNull}, because "not answered" is a legitimate state for a tick-all
 * question - ticking nothing is a commitment, not an omission - and because the service produces a
 * better message for a missing single choice than a bean-validation one would. The size ceiling of
 * six is structural and matches the option ceiling the schema and the validator share; it is
 * spelled out here rather than referenced from QuestionValidator, which lives in the admin package
 * that this one must not depend on.
 */
public record SubmitAnswerRequest(
        @NotNull Long questionId,
        /** The option chosen. Single-choice questions only. */
        Long optionId,
        /** Every option ticked. Multi-select questions only. May be empty. */
        @Size(max = 6, message = "That is more options than the question has.") List<Long> optionIds,
        /** How long the student took, for future analytics. Optional. */
        @Min(0) @Max(3_600_000) Integer timeMs) {}
