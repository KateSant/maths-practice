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
 *
 * <p>{@code misconceptionCodes} holds the register code of each wrong option the student actually
 * chose, so their feedback can name the error they made rather than list every error the question
 * catches. It belongs here and nowhere earlier: the student has already committed, and the correct
 * options are revealed in the same payload, so it gives nothing away. The codes are deliberately
 * kept out of the question the student sees beforehand, where they would mark the wrong options for
 * them. Empty when the answer is right, and for a wrong option carrying no code.
 */
public record AnswerResult(
        Long questionId,
        AnswerType answerType,
        boolean correct,
        List<Long> correctOptionIds,
        String explanation,
        List<String> misconceptionCodes,
        int pointsAwarded,
        int totalPoints,
        int currentStreak,
        int bestStreak,
        int answeredSoFar,
        int correctSoFar) {}
