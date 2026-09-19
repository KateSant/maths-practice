package com.realmaths.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.realmaths.support.Fixtures;
import org.junit.jupiter.api.Test;

class UserTest {

    private final User user = Fixtures.user(1L, "learner@example.com", "Learner");

    @Test
    void newUsersStartEmpty() {
        assertThat(user.getPoints()).isZero();
        assertThat(user.getCurrentStreak()).isZero();
        assertThat(user.getBestStreak()).isZero();
        assertThat(user.getRole()).isEqualTo(Role.STUDENT);
    }

    @Test
    void correctAnswersAddPointsAndGrowTheStreak() {
        user.recordCorrectAnswer(10);
        user.recordCorrectAnswer(10);
        user.recordCorrectAnswer(10);

        assertThat(user.getPoints()).isEqualTo(30);
        assertThat(user.getCurrentStreak()).isEqualTo(3);
        assertThat(user.getBestStreak()).isEqualTo(3);
    }

    @Test
    void aWrongAnswerResetsTheStreakButKeepsPointsAndBest() {
        user.recordCorrectAnswer(10);
        user.recordCorrectAnswer(10);
        user.recordIncorrectAnswer();

        assertThat(user.getPoints()).isEqualTo(20);
        assertThat(user.getCurrentStreak()).isZero();
        assertThat(user.getBestStreak()).isEqualTo(2);

        // Recovering must not lower the best streak.
        user.recordCorrectAnswer(10);
        assertThat(user.getCurrentStreak()).isEqualTo(1);
        assertThat(user.getBestStreak()).isEqualTo(2);
    }
}
