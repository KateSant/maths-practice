package com.realmaths.profile.dto;

import java.util.List;

public record StatsView(
        long totalAnswered,
        long totalCorrect,
        int accuracyPercent,
        long sessionsCompleted,
        List<TopicStats> byTopic) {}
