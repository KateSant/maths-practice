package com.realmaths.question.dto;

import com.realmaths.question.Topic;

public record TopicView(Long id, String slug, String name, String description, long questionCount) {

    public static TopicView from(Topic topic, long questionCount) {
        return new TopicView(topic.getId(), topic.getSlug(), topic.getName(), topic.getDescription(), questionCount);
    }
}
