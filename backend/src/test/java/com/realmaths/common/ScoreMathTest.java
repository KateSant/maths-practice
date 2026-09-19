package com.realmaths.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ScoreMathTest {

    @Test
    void roundsToTheNearestWholePercent() {
        assertThat(ScoreMath.percent(1, 3)).isEqualTo(33);
        assertThat(ScoreMath.percent(2, 3)).isEqualTo(67);
        assertThat(ScoreMath.percent(3, 4)).isEqualTo(75);
    }

    @Test
    void handlesPerfectAndZeroScores() {
        assertThat(ScoreMath.percent(5, 5)).isEqualTo(100);
        assertThat(ScoreMath.percent(0, 5)).isZero();
    }

    @Test
    void guardsAgainstDivisionByZero() {
        assertThat(ScoreMath.percent(0, 0)).isZero();
        assertThat(ScoreMath.percent(3, 0)).isZero();
    }
}
