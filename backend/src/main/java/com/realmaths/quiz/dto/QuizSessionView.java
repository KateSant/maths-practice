package com.realmaths.quiz.dto;

import com.realmaths.question.dto.QuestionView;
import com.realmaths.quiz.QuizSession;
import java.time.Instant;
import java.util.List;

public record QuizSessionView(
        Long sessionId,
        String topicSlug,
        String topicName,
        int questionCount,
        // The year group this set was dealt from, or null when it was mixed across years.
        Integer yearGroup,
        Instant startedAt,
        List<QuestionView> questions) {

    public static QuizSessionView from(QuizSession session) {
        String slug = session.getTopic() == null ? null : session.getTopic().getSlug();
        String name = session.getTopic() == null ? "Mixed practice" : session.getTopic().getName();

        return new QuizSessionView(
                session.getId(),
                slug,
                name,
                session.getQuestionCount(),
                session.getYearGroup(),
                session.getStartedAt(),
                session.getQuestions().stream().map(QuestionView::from).toList());
    }
}
