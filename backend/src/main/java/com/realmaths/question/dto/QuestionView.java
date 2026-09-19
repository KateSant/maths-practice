package com.realmaths.question.dto;

import com.realmaths.question.Question;
import java.util.List;

public record QuestionView(Long id, String prompt, int difficulty, List<AnswerOptionView> options) {

    public static QuestionView from(Question question) {
        List<AnswerOptionView> options = question.getOptions().stream()
                .map(AnswerOptionView::from)
                .toList();
        return new QuestionView(question.getId(), question.getPrompt(), question.getDifficulty(), options);
    }
}
