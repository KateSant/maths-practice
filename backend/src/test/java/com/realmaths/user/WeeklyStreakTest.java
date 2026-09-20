package com.realmaths.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class WeeklyStreakTest {

    /** 2026-09-14 is a Monday; the tests are written around that. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 14);

    private final User user = new User("student@example.com", "Student");

    @Nested
    @DisplayName("which week a date falls in")
    class Weeks {

        @Test
        void aWeekStartsOnMonday() {
            assertThat(MONDAY.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
            assertThat(WeeklyStreak.weekStart(MONDAY)).isEqualTo(MONDAY);
            assertThat(WeeklyStreak.weekStart(MONDAY.plusDays(3))).isEqualTo(MONDAY);
        }

        @Test
        void sundayBelongsToTheWeekThatStartedOnMonday() {
            // The one that matters: a Sunday evening is the end of the week, not the start of the next.
            assertThat(WeeklyStreak.weekStart(MONDAY.plusDays(6))).isEqualTo(MONDAY);
            assertThat(WeeklyStreak.weekStart(MONDAY.plusDays(7))).isEqualTo(MONDAY.plusWeeks(1));
        }
    }

    @Nested
    @DisplayName("the run of weeks")
    class TheRun {

        @Test
        void nothingYetIsZero() {
            assertThat(user.streakWeeksAsOf(MONDAY)).isZero();
        }

        @Test
        void oneWeekIsOne() {
            user.recordPractisedWeek(MONDAY);
            assertThat(user.streakWeeksAsOf(MONDAY)).isEqualTo(1);
        }

        @Test
        void twoSetsInTheSameWeekCountOnce() {
            user.recordPractisedWeek(MONDAY);
            user.recordPractisedWeek(MONDAY);
            user.recordPractisedWeek(MONDAY);
            assertThat(user.streakWeeksAsOf(MONDAY)).isEqualTo(1);
        }

        @Test
        void consecutiveWeeksBuildTheRun() {
            user.recordPractisedWeek(MONDAY);
            user.recordPractisedWeek(MONDAY.plusWeeks(1));
            user.recordPractisedWeek(MONDAY.plusWeeks(2));
            assertThat(user.streakWeeksAsOf(MONDAY.plusWeeks(2))).isEqualTo(3);
        }

        @Test
        void aMissedWeekStartsAgainFromOne() {
            user.recordPractisedWeek(MONDAY);
            user.recordPractisedWeek(MONDAY.plusWeeks(1));
            user.recordPractisedWeek(MONDAY.plusWeeks(3));
            assertThat(user.streakWeeksAsOf(MONDAY.plusWeeks(3))).isEqualTo(1);
        }

        @Test
        void theBestSurvivesTheReset() {
            user.recordPractisedWeek(MONDAY);
            user.recordPractisedWeek(MONDAY.plusWeeks(1));
            user.recordPractisedWeek(MONDAY.plusWeeks(4));
            assertThat(user.getBestStreakWeeks()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("the number on screen")
    class Displaying {

        @Test
        void practisingThisWeekKeepsItAliveButDoesNotGrowItYet() {
            user.recordPractisedWeek(MONDAY);
            // Same week, so the run is still one - it becomes two when next week's set lands.
            assertThat(user.streakWeeksAsOf(MONDAY.plusDays(6))).isEqualTo(1);
        }

        @Test
        void itSurvivesTheFollowingWeek() {
            user.recordPractisedWeek(MONDAY);
            // Wednesday of the next week: nothing yet this week, but the week is not over.
            assertThat(user.streakWeeksAsOf(MONDAY.plusWeeks(1).plusDays(2))).isEqualTo(1);
        }

        @Test
        void aWholeMissedWeekReadsAsZero() {
            user.recordPractisedWeek(MONDAY);
            // Monday of the week after next: the whole of last week went by with nothing.
            assertThat(user.streakWeeksAsOf(MONDAY.plusWeeks(2))).isZero();
        }

        @Test
        void itDoesNotReadAsBrokenEveryMonday() {
            user.recordPractisedWeek(MONDAY.plusWeeks(1));
            // Monday morning after practising last week: still 1, not 0.
            assertThat(user.streakWeeksAsOf(MONDAY.plusWeeks(2))).isEqualTo(1);
        }
    }
}
