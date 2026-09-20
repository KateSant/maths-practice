package com.realmaths.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * A rule the application enforces rather than a malformed request: 422, with field keys the
     * editor can attach to the right input. Spring picks the most specific handler, so this wins
     * over the {@link ApiException} one below despite the subclass relationship.
     */
    @ExceptionHandler(ApiValidationException.class)
    public ResponseEntity<ApiError> handleApiValidation(ApiValidationException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(ApiError.validation(ex.getStatus().value(), ex.getMessage(), ex.getFieldErrors()));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(ApiError.of(ex.getStatus().value(), ex.getMessage()));
    }

    /**
     * An unparseable query parameter, such as {@code ?status=BOGUS} or {@code ?difficulty=hard}.
     * Declared explicitly because the catch-all below would otherwise answer a client mistake
     * with a 500 and a stack trace.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String name = ex.getName();
        return ResponseEntity.badRequest()
                .body(ApiError.validation(
                        "That filter value is not recognised.",
                        Map.of(name, "'" + ex.getValue() + "' is not a valid " + name + ".")));
    }

    /** Bean-validation failures from {@code @Valid} request bodies. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(ApiError.validation("Please check the highlighted fields.", fieldErrors));
    }

    /**
     * A body that cannot be read at all: malformed JSON, or a value for an enum field that does not
     * exist, such as an unrecognised answer type. Declared explicitly for the same reason as the
     * query-parameter handler above - it is a client mistake, and the catch-all below would
     * otherwise answer it with a 500 and a stack trace.
     *
     * <p>Deliberately vague about which field, because Jackson's message names internal classes and
     * a student hitting it is not going to act on the difference. Field-level detail belongs on the
     * validator, which answers with real field keys.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("Unreadable request body: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.badRequest().body(ApiError.of(400, "That request body could not be read."));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiError.of(401, ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiError.of(401, "Not authenticated."));
    }

    /**
     * Declared explicitly so it is not swallowed by the catch-all below; Spring's
     * security filter chain, not this advice, normally deals with authorisation.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of(403, "You do not have access to that."));
    }

    /**
     * An unknown path. Declared explicitly because the catch-all below would otherwise
     * turn every 404 into a 500 with a full stack trace logged at ERROR, which buries
     * real failures. Spring raises this rather than NoHandlerFoundException when no
     * handler matches, which is the default configuration here.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResourceFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of(404, "No such endpoint."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(409, "That change conflicts with existing data."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        // Deliberately vague: internal details stay in the logs, not the response.
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of(500, "Something went wrong. Please try again."));
    }
}
