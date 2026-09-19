package com.realmaths.quiz.dto;

import com.realmaths.question.AnswerOption;
import com.realmaths.quiz.QuizAnswer;

public record QuestionReview(
        Long questionId,
        String prompt,
        String selectedLabel,
        String selectedText,
        boolean correct,
        String correctLabel,
        String correctText,
        String explanation) {

    public static QuestionReview from(QuizAnswer answer) {
        AnswerOption selected = answer.getSelectedOption();
        AnswerOption correctOption = answer.getQuestion().correctOption().orElse(null);

        return new QuestionReview(
                answer.getQuestion().getId(),
                answer.getQuestion().getPrompt(),
                selected == null ? null : selected.getLabel(),
                selected == null ? null : selected.getText(),
                answer.isCorrect(),
                correctOption == null ? null : correctOption.getLabel(),
                correctOption == null ? null : correctOption.getText(),
                answer.getQuestion().getExplanation());
    }
}
