package com.realmaths.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * A question as submitted by the editor, for either a draft or an immediate publish.
 *
 * <p>Only the constraints that are structural are declared here: field lengths the schema
 * stores, a difficulty the database constrains, and the six-option ceiling that labels A to F
 * allow. Everything about whether the question is <em>answerable</em> — a real prompt, enough
 * options, exactly one correct — is checked on the publish transition instead, because a
 * teacher has to be able to save something half-written and come back to it.
 *
 * <p>Note there is no {@code label} on an option: labels are derived from position on the
 * server, so a client cannot desync the two. There is no {@code status} or {@code origin}
 * either — status changes through publish and retire, and origin is not the client's to
 * claim.
 */
public record SaveQuestionRequest(
        @NotNull(message = "Choose a topic.") Long topicId,
        @Size(max = 1000, message = "Prompts are limited to 1000 characters.") String prompt,
        @Size(max = 1000, message = "Explanations are limited to 1000 characters.") String explanation,
        @Min(value = 1, message = "Difficulty runs from 1 to 5.")
                @Max(value = 5, message = "Difficulty runs from 1 to 5.")
                int difficulty,
        @Size(max = 6, message = "A question can have at most six options.")
                List<OptionDraft> options) {

    public record OptionDraft(
            @Size(max = 500, message = "Options are limited to 500 characters.") String text, boolean correct) {}
}
