package com.realmaths.admin.dto;

import com.realmaths.question.Question;
import com.realmaths.question.QuestionOrigin;
import com.realmaths.question.QuestionStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/** Everything the question editor needs, including the answer key. */
public record AdminQuestionDetail(
        Long id,
        Long topicId,
        String topicName,
        String prompt,
        String explanation,
        int difficulty,
        QuestionStatus status,
        QuestionOrigin origin,
        Instant createdAt,
        List<AdminOption> options) {

    public static AdminQuestionDetail from(Question question) {
        List<AdminOption> options = question.getOptions().stream()
                // By position, not insertion order, so a reload shows the same letters as the
                // request that produced them.
                .sorted(Comparator.comparingInt(option -> option.getPosition()))
                .map(AdminOption::from)
                .toList();

        return new AdminQuestionDetail(
                question.getId(),
                question.getTopic().getId(),
                question.getTopic().getName(),
                question.getPrompt(),
                question.getExplanation(),
                question.getDifficulty(),
                question.getStatus(),
                question.getOrigin(),
                question.getCreatedAt(),
                options);
    }
}
