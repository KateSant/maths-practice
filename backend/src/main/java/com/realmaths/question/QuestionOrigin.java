package com.realmaths.question;

/**
 * Where a question came from.
 *
 * <p>Informational, not behavioural — nothing branches on it. It exists so that the 32
 * questions shipped in the prototype can be told apart from a teacher's own content, which
 * is what makes "retire everything that came from the seed file" a single action rather than
 * a manual review of the whole list.
 */
public enum QuestionOrigin {
    /** Inserted by V2__seed_questions.sql. */
    SEED,
    /** Written through the admin interface. */
    AUTHORED,
    /** Brought in by a CSV import. */
    IMPORTED
}
