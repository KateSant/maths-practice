package com.realmaths.question;

import com.realmaths.common.ApiException;
import com.realmaths.question.dto.TopicView;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
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
    public List<TopicView> listTopics(Integer yearGroup) {
        YearGroups.requireValid(yearGroup);

        Map<Long, Long> counts = questionRepository
                .countByTopicWithStatus(QuestionStatus.PUBLISHED, yearGroup)
                .stream()
                .collect(Collectors.toMap(
                        QuestionRepository.TopicQuestionCount::getTopicId,
                        QuestionRepository.TopicQuestionCount::getTotal));

        return topicRepository.findAllByOrderBySortOrderAsc().stream()
                // A topic with nothing published for the chosen year is not a choice the student
                // can act on, so it is left out rather than shown with a zero. A card that looks
                // clickable and then fails to deal a set is a worse answer than no card.
                .filter(topic -> yearGroup == null || counts.getOrDefault(topic.getId(), 0L) > 0)
                .map(topic -> TopicView.from(topic, counts.getOrDefault(topic.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public Topic requireTopicBySlug(String slug) {
        return topicRepository.findBySlugIgnoreCase(slug.trim())
                .orElseThrow(() -> ApiException.notFound("No topic called '" + slug + "'."));
    }

    /**
     * Chooses a set of questions aimed at one difficulty, within one year group.
     *
     * <p>Selection prefers the target level and only reaches into the levels either side to make
     * up the numbers, because a topic may hold only a couple of questions at any one level. That
     * ordering matters: taking a random draw from a window wide enough to hold {@code count}
     * questions would let a thin bank dilute the band until the student's level barely mattered.
     *
     * <p>The result is ordered easiest first. Opening on the hardest question is a poor welcome
     * for someone who is already finding it hard, and a gentle ramp makes the level of the set
     * visible rather than something to be inferred.
     *
     * @param yearGroup the school year to draw from, or null for every year — which is what the
     *     mixed-practice path asks for, not what the student-facing dropdown does
     * @return questions with their options initialised, easiest first
     */
    @Transactional(readOnly = true)
    public List<Question> pickForSession(Long topicId, Integer yearGroup, int count, int targetLevel) {
        YearGroups.requireValid(yearGroup);

        List<QuestionRepository.QuestionDifficulty> candidates =
                questionRepository.listPublishedDifficulty(topicId, yearGroup);

        if (candidates.isEmpty()) {
            throw ApiException.badRequest(noQuestionsMessage(topicId, yearGroup));
        }

        // Shuffle, then sort by distance from the target. The sort is stable, so the order stays
        // random within a level while the closest level comes first.
        List<QuestionRepository.QuestionDifficulty> preferred = new ArrayList<>(candidates);
        Collections.shuffle(preferred);
        preferred.sort(Comparator.comparingInt(candidate -> Math.abs(candidate.getDifficulty() - targetLevel)));

        List<Long> ids = preferred.stream()
                .limit(count)
                .map(QuestionRepository.QuestionDifficulty::getId)
                .toList();

        Map<Long, Question> byId = questionRepository.findAllWithOptionsByIdIn(ids).stream()
                .collect(Collectors.toMap(Question::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));

        List<Question> questions = ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(ArrayList::new));

        // Shuffle again so the ramp-up order is not the selection order, then stable-sort.
        Collections.shuffle(questions);
        questions.sort(Comparator.comparingInt(Question::getDifficulty));
        return questions;
    }

    @Transactional(readOnly = true)
    public Question requireQuestion(Long questionId) {
        return questionRepository.findById(questionId)
                .orElseThrow(() -> ApiException.notFound("Question " + questionId + " does not exist."));
    }

    /**
     * Names the year group that came up empty, because a student who picked Year 9 and got
     * "no questions for that topic" would reasonably conclude the topic itself was empty.
     */
    private static String noQuestionsMessage(Long topicId, Integer yearGroup) {
        if (yearGroup == null) {
            return "There are no questions available for that topic yet.";
        }
        String year = YearGroups.label(yearGroup);
        return topicId == null
                ? "There are no " + year + " questions yet."
                : "There are no " + year + " questions for that topic yet.";
    }
}
