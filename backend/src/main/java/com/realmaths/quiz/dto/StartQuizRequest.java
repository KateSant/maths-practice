package com.realmaths.quiz.dto;

import com.realmaths.question.YearGroups;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * @param topicSlug null or blank means a mixed quiz across all topics
 * @param count     null means "use the configured default"
 * @param yearGroup the school year to draw questions from, 7 to 13. Null means every year, which
 *     keeps the endpoint usable without a year group; the student-facing flow always sends one,
 *     because the dropdown always has a value. It is a choice the student makes, not an attribute
 *     of their account, so a Year 7 may ask for Year 10 and get Year 10 questions.
 */
public record StartQuizRequest(
        String topicSlug,
        @Min(1) @Max(50) Integer count,
        @Min(value = YearGroups.MIN, message = "Year group must be between 7 and 13.")
                @Max(value = YearGroups.MAX, message = "Year group must be between 7 and 13.")
                Integer yearGroup) {}
