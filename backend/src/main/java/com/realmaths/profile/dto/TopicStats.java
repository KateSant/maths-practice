package com.realmaths.profile.dto;

import com.realmaths.common.ScoreMath;

public record TopicStats(Long topicId, String topicName, long answered, long correct, int accuracyPercent) {

    public static TopicStats of(Long topicId, String topicName, long answered, long correct) {
        return new TopicStats(topicId, topicName, answered, correct, ScoreMath.percent(correct, answered));
    }
}
