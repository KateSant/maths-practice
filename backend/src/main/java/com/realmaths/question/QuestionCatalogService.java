package com.realmaths.question;

import com.realmaths.common.ApiException;
import com.realmaths.question.dto.TopicView;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only access to the question bank. */
@Service
public class QuestionCatalogService {

    private final QuestionRepository questionRepository;
    private final TopicRepository topicRepository;

    public QuestionCatalogService(QuestionRepository questionRepository, TopicRepository topicRepository) {
        this.questionRepository = questionRepository;
        this.topicRepository = topicRepository;
    }

    @Transactional(readOnly = true)
    public List<TopicView> listTopics() {
        Map<Long, Long> counts = questionRepository
                .countByTopicWithStatus(QuestionStatus.PUBLISHED)
                .stream()
                .collect(Collectors.toMap(
                        QuestionRepository.TopicQuestionCount::getTopicId,
                        QuestionRepository.TopicQuestionCount::getTotal));

        return topicRepository.findAllByOrderBySortOrderAsc().stream()
                .map(topic -> TopicView.from(topic, counts.getOrDefault(topic.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public Topic requireTopicBySlug(String slug) {
        return topicRepository.findBySlugIgnoreCase(slug.trim())
                .orElseThrow(() -> ApiException.notFound("No topic called '" + slug + "'."));
    }

    /**
     * Chooses questions at random, optionally limited to one topic.
     *
     * @return questions with their options initialised, in the randomly chosen order
     */
    @Transactional(readOnly = true)
    public List<Question> pickForSession(Long topicId, int count) {
        List<Long> ids = topicId == null
                ? questionRepository.pickRandomIds(count)
                : questionRepository.pickRandomIdsForTopic(topicId, count);

        if (ids.isEmpty()) {
            throw ApiException.badRequest("There are no questions available for that topic yet.");
        }

        Map<Long, Question> byId = questionRepository.findAllWithOptionsByIdIn(ids).stream()
                .collect(Collectors.toMap(Question::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));

        // The database picked the order; keep it rather than the map's ordering.
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    @Transactional(readOnly = true)
    public Question requireQuestion(Long questionId) {
        return questionRepository.findById(questionId)
                .orElseThrow(() -> ApiException.notFound("Question " + questionId + " does not exist."));
    }
}
