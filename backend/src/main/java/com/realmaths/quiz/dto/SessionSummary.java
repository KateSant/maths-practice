package com.realmaths.quiz.dto;

import com.realmaths.common.ScoreMath;
import com.realmaths.quiz.QuizAnswer;
import com.realmaths.quiz.QuizSession;
import java.time.Instant;
import java.util.List;

public record SessionSummary(
        Long sessionId,
        String topicSlug,
        String topicName,
        /** The year group the set was dealt from, or null when it was mixed or not recorded. */
        Integer yearGroup,
        int questionCount,
        int answeredCount,
        int correctCount,
        int pointsAwarded,
        int accuracyPercent,
        Instant startedAt,
        Instant completedAt,
        /** The level the next set in this topic will be aimed at, given how this one went. */
        int level,
        /** The level this set was aimed at, so the two can be compared and the move shown. */
        int setLevel,
        /** Seconds of play time this score was worth. */
        int playSecondsEarned,
        List<QuestionReview> review) {

    public static SessionSummary from(
            QuizSession session, List<QuizAnswer> answers, int level, int setLevel, int playSecondsEarned) {
        return new SessionSummary(
                session.getId(),
                session.getTopic() == null ? null : session.getTopic().getSlug(),
                session.getTopic() == null ? "Mixed practice" : session.getTopic().getName(),
                session.getYearGroup(),
                session.getQuestionCount(),
                answers.size(),
                session.getCorrectCount(),
                session.getPointsAwarded(),
                ScoreMath.percent(session.getCorrectCount(), session.getQuestionCount()),
                session.getStartedAt(),
                session.getCompletedAt(),
                level,
                setLevel,
                playSecondsEarned,
                answers.stream().map(QuestionReview::from).toList());
    }
}
