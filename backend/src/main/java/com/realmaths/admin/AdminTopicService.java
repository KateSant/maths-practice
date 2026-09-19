package com.realmaths.admin;

import com.realmaths.admin.dto.AdminTopicView;
import com.realmaths.admin.dto.SaveTopicRequest;
import com.realmaths.common.ApiException;
import com.realmaths.question.Topic;
import com.realmaths.question.TopicRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authoring topics. Small, but the teacher will want her own wording before anything else. */
@Service
public class AdminTopicService {

    private final TopicRepository topics;

    public AdminTopicService(TopicRepository topics) {
        this.topics = topics;
    }

    @Transactional(readOnly = true)
    public List<AdminTopicView> list() {
        return topics.findAllByOrderBySortOrderAsc().stream().map(AdminTopicView::from).toList();
    }

    @Transactional
    public AdminTopicView create(SaveTopicRequest request) {
        requireSlugAvailable(request.slug(), null);
        Topic topic = new Topic(
                request.slug(), request.name().trim(), trimmed(request.description()), request.sortOrder());
        return AdminTopicView.from(topics.saveAndFlush(topic));
    }

    @Transactional
    public AdminTopicView update(long id, SaveTopicRequest request) {
        Topic topic = topics.findById(id)
                .orElseThrow(() -> ApiException.notFound("Topic " + id + " does not exist."));

        requireSlugAvailable(request.slug(), id);
        topic.revise(request.slug(), request.name().trim(), trimmed(request.description()), request.sortOrder());
        return AdminTopicView.from(topic);
    }

    /**
     * Slugs are the public identifier in quiz links, and the column is unique, so a clash has to
     * be reported as a clash rather than as whatever the database happens to say.
     *
     * @param ownerId the topic being edited, whose own slug is not a clash with itself
     */
    private void requireSlugAvailable(String slug, Long ownerId) {
        topics.findBySlugIgnoreCase(slug)
                .filter(existing -> !existing.getId().equals(ownerId))
                .ifPresent(existing -> {
                    throw ApiException.conflict("Another topic already uses the slug '" + slug + "'.");
                });
    }

    private static String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
