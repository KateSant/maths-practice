package com.realmaths.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.realmaths.common.ApiValidationException;
import com.realmaths.question.Question;
import com.realmaths.question.Topic;
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
        Question question = new Question(topic, prompt, "Because.", 1);
        for (int index = 0; index < options.length; index++) {
            // First option correct unless a test says otherwise.
            question.addOption(String.valueOf((char) ('A' + index)), options[index], index == 0);
        }
        return question;
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
        Question unmarked = new Question(topic, "What is 2 + 2?", "Because.", 1);
        unmarked.addOption("A", "4", false);
        unmarked.addOption("B", "5", false);

        assertThatThrownBy(() -> validator.requirePublishable(unmarked))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKey("options.correct"));
    }

    /**
     * The database refuses two correct options anyway, via answer_options_one_correct_idx. The
     * validator repeats the check so the teacher gets a sentence rather than an opaque 409.
     */
    @Test
    void refusesAQuestionWithTwoCorrectOptions() {
        Question question = new Question(topic, "What is 2 + 2?", "Because.", 1);
        question.addOption("A", "4", true);
        question.addOption("B", "5", true);

        assertThatThrownBy(() -> validator.requirePublishable(question))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .containsKey("options.correct"));
    }

    @Test
    void reportsEveryProblemAtOnceRatherThanOneAtATime() {
        Question question = new Question(topic, " ", "Because.", 1);
        question.addOption("A", "", false);

        assertThatThrownBy(() -> validator.requirePublishable(question))
                .isInstanceOf(ApiValidationException.class)
                .satisfies(ex -> assertThat(((ApiValidationException) ex).getFieldErrors())
                        .as("a teacher should not have to fix these one reload at a time")
                        .containsKeys("prompt", "options", "options[0].text", "options.correct"));
    }
}
