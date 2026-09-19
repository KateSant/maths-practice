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
        int questionCount,
        int answeredCount,
        int correctCount,
        int pointsAwarded,
        int accuracyPercent,
        Instant startedAt,
        Instant completedAt,
        List<QuestionReview> review) {

    public static SessionSummary from(QuizSession session, List<QuizAnswer> answers) {
        return new SessionSummary(
                session.getId(),
                session.getTopic() == null ? null : session.getTopic().getSlug(),
                session.getTopic() == null ? "Mixed practice" : session.getTopic().getName(),
                session.getQuestionCount(),
                answers.size(),
                session.getCorrectCount(),
                session.getPointsAwarded(),
                ScoreMath.percent(session.getCorrectCount(), session.getQuestionCount()),
                session.getStartedAt(),
                session.getCompletedAt(),
                answers.stream().map(QuestionReview::from).toList());
    }
}
