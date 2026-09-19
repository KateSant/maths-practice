package com.realmaths.common;

public final class ScoreMath {

    private ScoreMath() {}

    /** Rounded percentage of {@code part} out of {@code total}, guarding divide-by-zero. */
    public static int percent(long part, long total) {
        if (total <= 0) {
            return 0;
        }
        return (int) Math.round(100.0 * part / total);
    }
}
