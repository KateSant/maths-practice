package com.realmaths.question;

/**
 * How a question is answered, and therefore how it is graded.
 *
 * <p>This is the discriminator that keeps the pipeline from being hard-coded to one-at-a-time
 * multiple choice. It is deliberately about the <em>answer</em> rather than the presentation: a
 * question showing a graph is still a choice question, and a future numeric-entry type would slot
 * in here beside these two without either of them changing.
 *
 * <p>The rule that grades each type lives in {@code QuizService}, and the rule that decides
 * whether one is fit to publish lives in {@code QuestionValidator}. Both switch on this rather
 * than on anything inferred, so a question cannot be graded by one set of assumptions and
 * validated against another.
 */
public enum AnswerType {

    /** Pick exactly one option. The classic. */
    SINGLE_CHOICE,

    /**
     * Tick every option that applies, then submit the whole set.
     *
     * <p>Graded on the set as a whole - every correct option ticked and nothing else - rather
     * than on each tick individually. Partial credit was considered and rejected: it would make
     * the score, and with it the streak, no longer a count of questions answered correctly.
     */
    MULTI_SELECT;

    public boolean isMultiSelect() {
        return this == MULTI_SELECT;
    }
}
