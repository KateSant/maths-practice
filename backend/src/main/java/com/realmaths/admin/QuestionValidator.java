package com.realmaths.admin;

import com.realmaths.common.ApiValidationException;
import com.realmaths.question.AnswerOption;
import com.realmaths.question.Question;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Decides whether a question is fit to be shown to a student.
 *
 * <p>Kept separate from saving on purpose. A draft may be arbitrary: a teacher needs to create a
 * question, leave it half-written, and come back. The rules that make a question answerable are
 * checked on the {@code DRAFT} to {@code PUBLISHED} transition, and this is the single place
 * that happens, so the editor, a bulk publish and the CSV importer all pass through the same
 * gate rather than each enforcing their own version of it.
 */
@Component
public class QuestionValidator {

    /** Labels run A to F, which is what the {@code label varchar(4)} column allows room for. */
    static final int MAX_OPTIONS = 6;

    /**
     * Two is the minimum that constitutes a choice. One option is not a question, and the
     * correct answer would be trivially guessable.
     */
    static final int MIN_OPTIONS = 2;

    /**
     * @throws ApiValidationException with per-field messages when the question cannot be
     *     answered as written
     */
    public void requirePublishable(Question question) {
        Map<String, String> errors = new LinkedHashMap<>();

        if (question.getPrompt() == null || question.getPrompt().isBlank()) {
            errors.put("prompt", "A question needs a prompt before students can see it.");
        }

        List<AnswerOption> options = question.getOptions();
        if (options.size() < MIN_OPTIONS) {
            errors.put("options", "Give the question at least two options.");
        } else if (options.size() > MAX_OPTIONS) {
            errors.put("options", "A question can have at most " + MAX_OPTIONS + " options.");
        }

        for (int index = 0; index < options.size(); index++) {
            String text = options.get(index).getText();
            if (text == null || text.isBlank()) {
                // Keyed by index so the editor can highlight that specific input. The client
                // is expected to read this as options[index].text.
                errors.put("options[" + index + "].text", "This option is empty.");
            }
        }

        long correct = options.stream().filter(AnswerOption::isCorrect).count();
        if (correct == 0) {
            errors.put("options.correct", "Mark one option as the correct answer.");
        } else if (correct > 1) {
            // The database refuses this anyway, via answer_options_one_correct_idx, but a
            // sentence naming the problem beats an opaque 409 from a constraint violation.
            errors.put("options.correct", "Only one option can be the correct answer.");
        }

        if (!errors.isEmpty()) {
            throw new ApiValidationException("This question is not ready to publish yet.", errors);
        }
    }
}
