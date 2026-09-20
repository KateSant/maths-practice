package com.realmaths.admin;

import com.realmaths.admin.dto.CoverageView;
import com.realmaths.config.RealMathsProperties;
import com.realmaths.question.DifficultyBand;
import com.realmaths.question.QuestionRepository;
import com.realmaths.question.TopicRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * How many published questions each topic holds in each band.
 *
 * <p>Read-only and small, but it answers the question a teacher asks the moment the sets start
 * adapting: "can this topic actually give a student the level they are working at?"
 */
@Service
public class AdminCoverageService {

    private final TopicRepository topics;
    private final QuestionRepository questions;
    private final RealMathsProperties properties;

    public AdminCoverageService(
            TopicRepository topics, QuestionRepository questions, RealMathsProperties properties) {
        this.topics = topics;
        this.questions = questions;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public List<CoverageView> coverage() {
        Map<Long, Map<Integer, Long>> byTopic = questions.countPublishedByTopicAndBand().stream()
                .collect(Collectors.groupingBy(
                        QuestionRepository.TopicBandCount::getTopicId,
                        Collectors.toMap(
                                QuestionRepository.TopicBandCount::getDifficulty,
                                QuestionRepository.TopicBandCount::getTotal)));

        int setSize = properties.quiz().defaultQuestionCount();

        return topics.findAllByOrderBySortOrderAsc().stream()
                .map(topic -> {
                    Map<Integer, Long> counts = byTopic.getOrDefault(topic.getId(), Map.of());

                    // Every band is listed even when it is empty, because a gap is the thing worth
                    // seeing and a missing row is easier to skim past than a zero.
                    List<CoverageView.BandCount> bands = IntStream
                            .rangeClosed(DifficultyBand.EASIEST, DifficultyBand.HARDEST)
                            .mapToObj(band -> new CoverageView.BandCount(band, counts.getOrDefault(band, 0L)))
                            .toList();

                    long published = bands.stream().mapToLong(CoverageView.BandCount::questions).sum();
                    return new CoverageView(
                            topic.getId(), topic.getName(), bands, published, published >= setSize);
                })
                .toList();
    }
}
