package com.realmaths.question;

import com.realmaths.common.ApiException;

/**
 * The year groups the question bank is organised into: 7 to 13, the secondary years.
 *
 * <p>A plain integer range rather than an enum. The number is what the API sends, what the
 * dropdown shows and what the column stores, so an enum would put a translation layer on both
 * sides of the wire and buy nothing: the seven values are fixed by the school system, not by us.
 *
 * <p>Which year group a student practises at is their choice, not a fact about them. A Year 7
 * who wants to work at Year 10 level picks Year 10 and is dealt Year 10 questions; there is no
 * year group on a user and no age asked for at sign-up. That is why this is a filter on the quiz
 * rather than an attribute of the account.
 */
public final class YearGroups {

    public static final int MIN = 7;
    public static final int MAX = 13;

    private YearGroups() {}

    public static boolean isValid(Integer yearGroup) {
        return yearGroup != null && yearGroup >= MIN && yearGroup <= MAX;
    }

    /**
     * Rejects a year group outside 7..13 as a client error.
     *
     * <p>Used for query parameters, which bean validation does not reach. Request bodies declare
     * the same range with {@code @Min} and {@code @Max} instead, so both paths end as a 400.
     *
     * @return the value unchanged, so a caller can validate and use it in one expression
     */
    public static Integer requireValid(Integer yearGroup) {
        if (yearGroup != null && !isValid(yearGroup)) {
            throw ApiException.badRequest("Year group must be between " + MIN + " and " + MAX + ".");
        }
        return yearGroup;
    }

    public static String label(int yearGroup) {
        return "Year " + yearGroup;
    }
}
