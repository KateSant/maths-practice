package com.realmaths.quiz.dto;

import com.realmaths.question.AnswerType;
import java.util.List;

/**
 * The graded outcome of one answer. This is the only place the correct answer is
 * revealed, and only after the student has committed to an answer.
 *
 * <p>A list of correct option ids rather than one, so a tick-all question can reveal the whole set.
 * A single-choice question is the case where the list has one entry, which is what lets the quiz
 * screen highlight options with the same rule for both types.
 */
public record AnswerResult(
        Long questionId,
        AnswerType answerType,
        boolean correct,
        List<Long> correctOptionIds,
        String explanation,
        int pointsAwarded,
        int totalPoints,
        int currentStreak,
        int bestStreak,
        int answeredSoFar,
        int correctSoFar) {}
