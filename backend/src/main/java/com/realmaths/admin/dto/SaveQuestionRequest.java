package com.realmaths.admin.dto;

import com.realmaths.question.AnswerType;
import com.realmaths.question.YearGroups;
import jakarta.validation.Valid;
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
 *
 * <p>{@code yearGroup} is the exception to "the client sends everything": it is nullable, and an
 * absent value means Year 7, matching the column default. A caller that has not been taught about
 * year groups — an older client, or a future CSV importer — therefore puts content in the first
 * year of secondary school rather than failing or filing it somewhere invisible.
 *
 * <p>{@code answerType} is likewise nullable and defaults to {@code SINGLE_CHOICE}, so a client
 * written before tick-all questions existed keeps producing the questions it meant to. An omitted
 * answer type is a client that only knows about one type, not an ambiguous question.
 */
public record SaveQuestionRequest(
        @NotNull(message = "Choose a topic.") Long topicId,
        @Size(max = 1000, message = "Prompts are limited to 1000 characters.") String prompt,
        @Size(max = 1000, message = "Explanations are limited to 1000 characters.") String explanation,
        @Min(value = 1, message = "Difficulty runs from 1 to 4.")
                @Max(value = 4, message = "Difficulty runs from 1 to 4.")
                int difficulty,
        @Min(value = YearGroups.MIN, message = "Year group must be between 7 and 13.")
                @Max(value = YearGroups.MAX, message = "Year group must be between 7 and 13.")
                Integer yearGroup,
        AnswerType answerType,
        @Size(max = 6, message = "A question can have at most six options.")
                // @Valid is load-bearing: without it the constraints inside OptionDraft (the 500
                // character option text and the 60 character misconception code) are declared but
                // never evaluated, because a List does not cascade on its own.
                @Valid
                List<OptionDraft> options) {

    public record OptionDraft(
            @Size(max = 500, message = "Options are limited to 500 characters.") String text,
            boolean correct,
            // The misconception code this option catches, or null. The 60-character ceiling matches
            // the answer_options.misconception_code column, so a code that fits the register cannot
            // be rejected by the database.
            @Size(max = 60, message = "Misconception codes are limited to 60 characters.") String misconceptionCode) {}
}
