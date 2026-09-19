package com.realmaths.quiz.dto;

import com.realmaths.common.ScoreMath;
import com.realmaths.quiz.QuizSession;
import java.time.Instant;

public record QuizHistoryItem(
        Long sessionId,
        String topicName,
        int questionCount,
        int correctCount,
        int pointsAwarded,
        int accuracyPercent,
        Instant completedAt) {

    public static QuizHistoryItem from(QuizSession session) {
        return new QuizHistoryItem(
                session.getId(),
                session.getTopic() == null ? "Mixed practice" : session.getTopic().getName(),
                session.getQuestionCount(),
                session.getCorrectCount(),
                session.getPointsAwarded(),
                ScoreMath.percent(session.getCorrectCount(), session.getQuestionCount()),
                session.getCompletedAt());
    }
}
