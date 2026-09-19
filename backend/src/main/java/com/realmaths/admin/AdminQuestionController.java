package com.realmaths.admin;

import com.realmaths.admin.dto.AdminQuestionDetail;
import com.realmaths.admin.dto.AdminQuestionSummary;
import com.realmaths.admin.dto.PageResponse;
import com.realmaths.admin.dto.SaveQuestionRequest;
import com.realmaths.question.QuestionOrigin;
import com.realmaths.question.QuestionStatus;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authoring endpoints for questions.
 *
 * <p>Reachability is decided in {@code SecurityConfig} by the {@code /api/admin/**} path prefix,
 * not here: a new endpoint added to this class is protected by virtue of where it lives, and
 * {@code AdminApiTest} fails the build if anything answers a student.
 */
@RestController
@RequestMapping("/api/admin/questions")
public class AdminQuestionController {

    /**
     * A ceiling on page size, so a client cannot ask for the entire question bank in one
     * request and force the server to materialise it.
     */
    private static final int MAX_PAGE_SIZE = 100;

    private final AdminQuestionService questions;

    public AdminQuestionController(AdminQuestionService questions) {
        this.questions = questions;
    }

    @GetMapping
    public PageResponse<AdminQuestionSummary> list(
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) QuestionStatus status,
            @RequestParam(required = false) Integer difficulty,
            @RequestParam(required = false) QuestionOrigin origin,
            // Named `q` rather than `search` so the query string reads like a search box.
            @RequestParam(required = false, name = "q") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return questions.list(topicId, status, difficulty, origin, search, pageable(page, size));
    }

    @GetMapping("/{id}")
    public AdminQuestionDetail get(@PathVariable long id) {
        return questions.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminQuestionDetail create(@Valid @RequestBody SaveQuestionRequest request) {
        return questions.create(request);
    }

    @PutMapping("/{id}")
    public AdminQuestionDetail update(@PathVariable long id, @Valid @RequestBody SaveQuestionRequest request) {
        return questions.update(id, request);
    }

    /**
     * A POST rather than a PUT to {@code /status}: publishing is an action with a validation
     * gate behind it, not a field assignment, and modelling it as one makes the gate easier to
     * bypass by accident.
     */
    @PostMapping("/{id}/publish")
    public AdminQuestionDetail publish(@PathVariable long id) {
        return questions.publish(id);
    }

    @PostMapping("/{id}/retire")
    public AdminQuestionDetail retire(@PathVariable long id) {
        return questions.retire(id);
    }

    private static Pageable pageable(int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        // Newest first: a question she has just written is the one she is most likely looking for.
        return PageRequest.of(Math.max(page, 0), boundedSize, Sort.by(Sort.Direction.DESC, "id"));
    }
}
