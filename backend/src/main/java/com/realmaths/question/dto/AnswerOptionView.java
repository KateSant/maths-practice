package com.realmaths.question.dto;

import com.realmaths.question.AnswerOption;

/** An option as the student sees it: id, letter and text. Never the answer key. */
public record AnswerOptionView(Long id, String label, String text) {

    public static AnswerOptionView from(AnswerOption option) {
        return new AnswerOptionView(option.getId(), option.getLabel(), option.getText());
    }
}
