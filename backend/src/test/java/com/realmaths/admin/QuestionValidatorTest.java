package com.realmaths.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.realmaths.common.ApiValidationException;
import com.realmaths.question.AnswerType;
import com.realmaths.question.Question;
import com.realmaths.question.Topic;
import com.realmaths.question.YearGroups;
import com.realmaths.support.Fixtures;
import org.junit.jupiter.api.Test;

/**
 * The rules that decide whether a question may be shown to a student.
 *
 * <p>These are the checks that separate "saved" from "publishable". Everything here is rejected
 * on publish and permitted on save, which is what lets a teacher leave a question half-written.
 */
class QuestionValidatorTest {

    private final QuestionValidator validator = new QuestionValidator();
    private final Topic topic = Fixtures.topic(1L, "number", "Number");

    private Question question(String prompt, String... options) {
        Question question = new Question(topic, prompt, "Because.", 1, YearGroups.MIN, AnswerType.SINGLE_CHOICE);
        for (int index = 0; index < options.length; index++) {
            // First option correct unless a test says otherwise.
            question.addOption(String.valueOf((char) ('A' + index)), options[index], index == 0);
        }
        return question;
    }

    /** @param correctIndexes zero-based into {@code options} */
    private Question tickAll(String prompt, int[] correctIndexes, String... options) {
        return Fixtures.multiSelectQuestion(1L, topic, prompt, "Because.", correctIndexes, options);
    }

    @Test
    void acceptsAWellFormedQuestion() {
        assertThatCode(() -> validator.requirePublishable(question("What is 2 + 2?", "4", "5"))).doesNotThrowAnyException();
    }

    @Test
    void refusesABlankPrompt() {
        // Saving this is fine; publishing it is not. The distinction is the whole design.
        assertThatThrownBy(() -> validator.requirePublishable(question("   ", "4", "5")))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors()).containsKey("prompt"));
    }

    @Test
    void refusesFewerThanTwoOptions() {
        assertThatThrownBy(() -> validator.requirePublishable(question("What is 2 + 2?", "4")))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors()).containsKey("options"));
    }

    @Test
    void refusesAQuestionWithNoOptionsAtAll() {
        assertThatThrownBy(() -> validator.requirePublishable(question("What is 2 + 2?")))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKeys("options", "options.correct"));
    }

    /** Keyed by index so the editor can highlight the specific input that is empty. */
    @Test
    void refusesAnEmptyOptionAndNamesItByIndex() {
        assertThatThrownBy(() -> validator.requirePublishable(question("What is 2 + 2?", "4", "  ")))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKey("options[1].text"));
    }

    @Test
    void refusesAQuestionWithNoCorrectOption() {
        Question unmarked = new Question(topic, "What is 2 + 2?", "Because.", 1, YearGroups.MIN, AnswerType.SINGLE_CHOICE);
        unmarked.addOption("A", "4", false);
        unmarked.addOption("B", "5", false);

        assertThatThrownBy(() -> validator.requirePublishable(unmarked))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKey("options.correct"));
    }

    /**
     * The database refuses two correct options on a single-choice question anyway, via the
     * answer_options_single_choice_insert trigger. The validator repeats the check so the teacher
     * gets a sentence rather than an opaque 409.
     */
    @Test
    void refusesASingleChoiceQuestionWithTwoCorrectOptions() {
        Question question = new Question(topic, "What is 2 + 2?", "Because.", 1, YearGroups.MIN, AnswerType.SINGLE_CHOICE);
        question.addOption("A", "4", true);
        question.addOption("B", "5", true);

        assertThatThrownBy(() -> validator.requirePublishable(question))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKey("options.correct"));
    }

    // ------------------------------------------------------------- tick all that apply ---

    @Test
    void acceptsATickAllQuestionWithSeveralCorrectOptions() {
        assertThatCode(() -> validator.requirePublishable(
                        tickAll("Tick every prime.", new int[] {1, 2}, "21", "29", "37", "39")))
                .doesNotThrowAnyException();
    }

    /**
     * The mirror of the single-choice rule: a tick-all question may have many right answers, but
     * it still has to have one. The database enforces the ceiling on a single choice and nothing
     * enforces this floor, which is why it is checked here.
     */
    @Test
    void refusesATickAllQuestionWithNoCorrectOptions() {
        assertThatThrownBy(() -> validator.requirePublishable(
                        tickAll("Tick every prime.", new int[] {}, "21", "39")))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKey("options.correct"));
    }

    /**
     * One correct option is a perfectly good tick-all question - "tick every prime" with a single
     * prime among the options. Refusing it would be the validator inventing a rule the domain does
     * not have.
     */
    @Test
    void acceptsATickAllQuestionWithExactlyOneCorrectOption() {
        assertThatCode(() -> validator.requirePublishable(
                        tickAll("Tick every prime.", new int[] {1}, "21", "29", "39")))
                .doesNotThrowAnyException();
    }

    @Test
    void appliesTheSameOptionAndPromptRulesToATickAllQuestion() {
        assertThatThrownBy(() -> validator.requirePublishable(tickAll("  ", new int[] {0}, "21", "")))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKeys("prompt", "options[1].text"));
    }

    @Test
    void reportsEveryProblemAtOnceRatherThanOneAtATime() {
        Question question = new Question(topic, " ", "Because.", 1, YearGroups.MIN, AnswerType.SINGLE_CHOICE);
        question.addOption("A", "", false);

        assertThatThrownBy(() -> validator.requirePublishable(question))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .as("a teacher should not have to fix these one reload at a time")
                        .containsKeys("prompt", "options", "options[0].text", "options.correct"));
    }
}
