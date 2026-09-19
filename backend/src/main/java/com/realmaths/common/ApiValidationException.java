package com.realmaths.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * A request that made perfect sense but breaks a rule the application enforces — publishing a
 * question with no correct option, or with two.
 *
 * <p>Distinct from {@link ApiException} so it can be answered with 422 and per-field messages,
 * which is what lets the editor point at the offending option instead of showing a toast that
 * says "invalid". "I understood you and I refuse" is a different situation from "that request
 * was malformed", and the two deserve different status codes.
 *
 * <p>Worth knowing that two correct options are already impossible to store — the partial
 * unique index {@code answer_options_one_correct_idx} refuses it. The validator still checks,
 * because a database error surfaces as an opaque 409 while this surfaces as a sentence
 * pointing at the problem.
 */
public class ApiValidationException extends ApiException {

    private final Map<String, String> fieldErrors;

    public ApiValidationException(String message, Map<String, String> fieldErrors) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, message);
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
