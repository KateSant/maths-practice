package com.realmaths.question;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class DifficultyBandTest {

    @Nested
    @DisplayName("the level a set is dealt at")
    class LevelForAccuracy {

        @Test
        void startsInTheMiddleWithNoHistory() {
            assertThat(DifficultyBand.forAccuracy(0, 0)).isEqualTo(DifficultyBand.STARTING);
        }

        @Test
        void dropsToTheEasiestWhenTheStudentIsStruggling() {
            // 2 of 10 correct.
            assertThat(DifficultyBand.forAccuracy(10, 2)).isEqualTo(1);
        }

        @Test
        void climbsWithSustainedSuccess() {
            assertThat(DifficultyBand.forAccuracy(10, 4)).isEqualTo(2);
            assertThat(DifficultyBand.forAccuracy(10, 7)).isEqualTo(3);
            assertThat(DifficultyBand.forAccuracy(10, 9)).isEqualTo(4);
            assertThat(DifficultyBand.forAccuracy(10, 10)).isEqualTo(4);
        }

        @Test
        void neverLeavesTheRangeTheBankUses() {
            IntStream.rangeClosed(0, 20).forEach(correct ->
                    IntStream.rangeClosed(0, 20).forEach(answered -> {
                        int level = DifficultyBand.forAccuracy(answered, correct);
                        assertThat(level).isBetween(DifficultyBand.EASIEST, DifficultyBand.HARDEST);
                    }));
        }

        @Test
        void aSingleAnswerIsNotEnoughToDropToTheBottom() {
            // One wrong answer out of one is 0%, which is 1 - but a student normally has a
            // history by then, and this documents that the rule is not "any miss, easiest set".
            assertThat(DifficultyBand.forAccuracy(1, 0)).isEqualTo(1);
            assertThat(DifficultyBand.forAccuracy(1, 1)).isEqualTo(DifficultyBand.HARDEST);
        }
    }
}
