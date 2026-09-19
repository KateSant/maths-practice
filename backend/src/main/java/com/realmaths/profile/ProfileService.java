package com.realmaths.profile;

import com.realmaths.auth.dto.UserResponse;
import com.realmaths.common.ApiException;
import com.realmaths.common.ScoreMath;
import com.realmaths.profile.dto.ProfileView;
import com.realmaths.profile.dto.StatsView;
import com.realmaths.profile.dto.TopicStats;
import com.realmaths.quiz.QuizAnswerRepository;
import com.realmaths.quiz.QuizSessionRepository;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.util.List;
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

        List<TopicStats> byTopic = answerRepository.accuracyByTopicForUser(userId).stream()
                .map(row -> TopicStats.of(
                        row.getTopicId(),
                        row.getTopicName(),
                        row.getAnswered(),
                        row.getCorrect() == null ? 0 : row.getCorrect()))
                .toList();

        return new StatsView(
                answered,
                correct,
                ScoreMath.percent(correct, answered),
                sessionRepository.countByUserIdAndCompletedAtIsNotNull(userId),
                byTopic);
    }
}
