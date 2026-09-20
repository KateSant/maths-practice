package com.realmaths.profile;

import com.realmaths.auth.dto.UserResponse;
import com.realmaths.common.ApiException;
import com.realmaths.common.ScoreMath;
import com.realmaths.profile.dto.ProfileView;
import com.realmaths.profile.dto.StatsView;
import com.realmaths.profile.dto.TopicStats;
import com.realmaths.question.DifficultyBand;
import com.realmaths.quiz.QuizAnswerRepository;
import com.realmaths.quiz.QuizSessionRepository;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    private final UserRepository userRepository;
    private final QuizAnswerRepository answerRepository;
    private final QuizSessionRepository sessionRepository;

    public ProfileService(
            UserRepository userRepository,
            QuizAnswerRepository answerRepository,
            QuizSessionRepository sessionRepository) {
        this.userRepository = userRepository;
        this.answerRepository = answerRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional(readOnly = true)
    public ProfileView getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Account not found."));
        return new ProfileView(UserResponse.from(user), buildStats(userId));
    }

    @Transactional
    public ProfileView updateDisplayName(Long userId, String displayName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Account not found."));
        user.setDisplayName(displayName.trim());
        return new ProfileView(UserResponse.from(user), buildStats(userId));
    }

    private StatsView buildStats(Long userId) {
        long answered = answerRepository.countByUserId(userId);
        long correct = answerRepository.countCorrectByUserId(userId);

        // The level the student is working at now, per topic. Same rule the next set is dealt by,
        // so what the topic list shows is what the practice will actually do.
        Map<Long, Integer> levels = answerRepository
                .recentAccuracyByTopic(userId, DifficultyBand.RECENT_ANSWERS, null)
                .stream()
                .collect(Collectors.toMap(
                        QuizAnswerRepository.RecentTopicAccuracy::getTopicId,
                        row -> DifficultyBand.forAccuracy(row.getAnswered(), row.getCorrect())));

        List<TopicStats> byTopic = answerRepository.accuracyByTopicForUser(userId).stream()
                .map(row -> TopicStats.of(
                        row.getTopicId(),
                        row.getTopicName(),
                        row.getAnswered(),
                        row.getCorrect() == null ? 0 : row.getCorrect(),
                        levels.getOrDefault(row.getTopicId(), DifficultyBand.forAccuracy(0, 0))))
                .toList();

        return new StatsView(
                answered,
                correct,
                ScoreMath.percent(correct, answered),
                sessionRepository.countByUserIdAndCompletedAtIsNotNull(userId),
                byTopic);
    }
}
