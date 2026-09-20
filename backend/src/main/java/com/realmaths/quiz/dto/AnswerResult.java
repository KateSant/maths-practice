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
 * <p>{@code caught} names what the student's wrong choices got wrong: one entry per wrong option
 * they picked, carrying the register code (for the teacher) and the message written for that option
 * (for the student), which is null when the option has no message of its own. It belongs here and
 * nowhere earlier: the student has already committed, and the correct options are revealed in the
 * same payload, so it gives nothing away. Nothing carries a code or a message beforehand, where it
 * would mark the wrong options for them.
 */
public record AnswerResult(
        Long questionId,
        AnswerType answerType,
        boolean correct,
        List<Long> correctOptionIds,
        String explanation,
        List<CaughtError> caught,
        int pointsAwarded,
        int totalPoints,
        int currentStreak,
        int bestStreak,
        int answeredSoFar,
        int correctSoFar) {

    /**
     * One error a wrong pick caught.
     *
     * <p>Both halves are here because they answer different questions. The code is the error class,
     * which is what a teacher's dashboard counts and what the register's generic line is keyed on;
     * the message is written for this option, because one class can cover two options in the same
     * question that are different misreadings - 0.2 means tenths, 0.002 means thousandths, and both
     * catch PV-COLUMN-NAME.
     */
    public record CaughtError(String misconceptionCode, String feedback) {}
}
