package com.realmaths.user;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

/**
 * The week arithmetic behind the "weeks in a row" streak.
 *
 * <p>A week runs Monday to Sunday. Everything is stored as an instant in UTC, so "which week is
 * it?" needs a zone to answer: a student practising at 11pm on a Sunday in January is in the week
 * that ends that night, while in UTC they are already in the next one. London, because that is
 * where the students are - and this is the only place that decision is written down.
 */
public final class WeeklyStreak {

    public static final ZoneId ZONE = ZoneId.of("Europe/London");

    private WeeklyStreak() {
    }

    /** The Monday that starts the week containing {@code date}. */
    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /** Today, as the students would name it. */
    public static LocalDate today(Clock clock) {
        return LocalDate.ofInstant(clock.instant(), ZONE);
    }

    /** The Monday of the week we are in now. */
    public static LocalDate currentWeekStart(Clock clock) {
        return weekStart(today(clock));
    }
}
