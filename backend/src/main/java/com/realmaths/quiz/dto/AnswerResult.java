package com.realmaths.quiz.dto;

/**
 * The graded outcome of one answer. This is the only place the correct option is
 * revealed, and only after the student has committed to an answer.
 */
public record AnswerResult(
        Long questionId,
        boolean correct,
        Long correctOptionId,
        String explanation,
        int pointsAwarded,
        int totalPoints,
        int currentStreak,
        int bestStreak,
        int answeredSoFar,
        int correctSoFar) {}
