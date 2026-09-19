package com.realmaths.quiz;

import com.realmaths.auth.UserPrincipal;
import com.realmaths.quiz.dto.AnswerResult;
import com.realmaths.quiz.dto.QuizSessionView;
import com.realmaths.quiz.dto.SessionSummary;
import com.realmaths.quiz.dto.StartQuizRequest;
import com.realmaths.quiz.dto.SubmitAnswerRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quiz/sessions")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuizSessionView start(
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody StartQuizRequest request) {
        return quizService.startSession(principal.id(), request);
    }

    @GetMapping("/{sessionId}")
    public SessionSummary get(
            @AuthenticationPrincipal UserPrincipal principal, @PathVariable Long sessionId) {
        return quizService.getSession(principal.id(), sessionId);
    }

    @PostMapping("/{sessionId}/answers")
    public AnswerResult answer(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId,
            @Valid @RequestBody SubmitAnswerRequest request) {
        return quizService.submitAnswer(principal.id(), sessionId, request);
    }

    @PostMapping("/{sessionId}/complete")
    public SessionSummary complete(
            @AuthenticationPrincipal UserPrincipal principal, @PathVariable Long sessionId) {
        return quizService.completeSession(principal.id(), sessionId);
    }
}
