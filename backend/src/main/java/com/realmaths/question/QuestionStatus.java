package com.realmaths.question;

/**
 * Where a question is in its life.
 *
 * <p>{@code DRAFT} is deliberately allowed to be an invalid question: a teacher has to be
 * able to save something half-written and come back to it. The rules that make a question
 * answerable — a prompt, at least two options, exactly one of them correct — are enforced on
 * the {@code DRAFT} to {@code PUBLISHED} transition instead, in
 * {@link com.realmaths.admin.QuestionValidator}. Anything already published keeps working.
 *
 * <p>{@code RETIRED} is how a question leaves circulation. It is never deleted, because
 * {@code quiz_answers} cascades on delete and deleting a question would take students'
 * answer history with it.
 */
public enum QuestionStatus {
    DRAFT,
    PUBLISHED,
    RETIRED
}
