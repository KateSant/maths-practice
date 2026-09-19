package com.realmaths.admin.dto;

import com.realmaths.question.Topic;

/**
 * A topic as the admin sees it. Unlike the student-facing {@code TopicView} this carries no
 * question count: counts on this screen want to be per-status to be useful ("3 published, 7
 * drafts"), and that belongs with the coverage view rather than duplicated here.
 */
public record AdminTopicView(Long id, String slug, String name, String description, int sortOrder) {

    public static AdminTopicView from(Topic topic) {
        return new AdminTopicView(
                topic.getId(), topic.getSlug(), topic.getName(), topic.getDescription(), topic.getSortOrder());
    }
}
