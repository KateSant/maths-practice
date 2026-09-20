package com.realmaths.admin.dto;

import com.realmaths.question.QuestionOrigin;
import com.realmaths.question.QuestionStatus;
import java.time.Instant;

/**
 * A row in the admin question list.
 *
 * <p>Deliberately without its options. A list shows a prompt and some metadata, and joining a
 * collection to render it would make Hibernate paginate in memory instead of in the database.
 *
 * <p>In the {@code admin} package on purpose: this type carries no answer key, but it sits
 * beside ones that do, and keeping admin DTOs together makes it obvious at a glance which side
 * of that line a type falls on. Nothing here is ever used to serve a student.
 */
public record AdminQuestionSummary(
        Long id,
        String prompt,
        Long topicId,
        String topicName,
        int difficulty,
        int yearGroup,
        QuestionStatus status,
        QuestionOrigin origin,
        Instant createdAt) {

    public static AdminQuestionSummary from(com.realmaths.question.Question question) {
        return new AdminQuestionSummary(
                question.getId(),
                question.getPrompt(),
                question.getTopic().getId(),
                question.getTopic().getName(),
                question.getDifficulty(),
                question.getYearGroup(),
                question.getStatus(),
                question.getOrigin(),
                question.getCreatedAt());
    }
}
