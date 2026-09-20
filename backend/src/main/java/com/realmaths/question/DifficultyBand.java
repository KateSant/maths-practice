package com.realmaths.question;

import com.realmaths.common.ScoreMath;

/**
 * Chooses the difficulty to aim a practice set at, from how the student has been doing.
 *
 * <p>Deliberately coarse: one level for a whole set, decided before it is dealt, rather than a
 * question-by-question adjustment. A set whose difficulty moves underfoot is hard to read -
 * "did I get that wrong because it was hard, or because it just got harder?" - and a student can
 * see where they stand instead of having to guess.
 *
 * <p>Recency, not a calendar window: callers pass the newest answers, so someone who struggled
 * last week gets a gentler set this week, and someone who has not practised for a month is
 * judged on what they last did rather than reset to the middle.
 *
 * <p>Four bands, numbered 1 to 4. The words for them are the frontend's business and live in
 * {@code lib/format.ts}, so the vocabulary can be reworded without touching the API or the schema.
 * The schema allows 1-5, which leaves room for a fifth band later without a migration; nothing in
 * the app uses 5 today.
 */
public final class DifficultyBand {

    public static final int EASIEST = 1;
    public static final int HARDEST = 4;

    /** Where a student with nothing to go on starts: the second of four, not the easiest. */
    public static final int STARTING = 2;

    /**
     * How many recent answers decide a level. Ten is enough that one bad question does not move
     * the band, and short enough that last week's form counts for more than last term's.
     */
    public static final int RECENT_ANSWERS = 10;

    private DifficultyBand() {
    }

    /**
     * The level to deal at.
     *
     * <p>The thresholds are wide on purpose. A single lucky or unlucky set should not move a
     * student; only a sustained change should. They are also biased towards the middle: a student
     * answering half correctly sits at 2, not at the bottom, because "half right" is where a
     * learner normally is and dropping them to the easiest questions would stop them progressing.
     */
    public static int forAccuracy(long answered, long correct) {
        if (answered <= 0) {
            return STARTING;
        }

        int percent = ScoreMath.percent(correct, answered);
        if (percent >= 85) {
            return 4;
        }
        if (percent >= 60) {
            return 3;
        }
        if (percent >= 35) {
            return 2;
        }
        return EASIEST;
    }
}
