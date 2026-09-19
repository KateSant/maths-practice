package com.realmaths.quiz.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * @param topicSlug null or blank means a mixed quiz across all topics
 * @param count     null means "use the configured default"
 */
public record StartQuizRequest(String topicSlug, @Min(1) @Max(50) Integer count) {}
