package com.realmaths.admin.dto;

import com.realmaths.question.AnswerOption;

/**
 * An option as the editor sees it, including whether it is the correct one.
 *
 * <p>This is the type that must never reach a student. The student API serves
 * {@link com.realmaths.question.dto.AnswerOptionView}, which has no correctness field at all,
 * and grading happens on the server. The separation is by package so that it stays visible.
 */
public record AdminOption(Long id, String label, String text, boolean correct, String misconceptionCode) {

    public static AdminOption from(AnswerOption option) {
        return new AdminOption(
                option.getId(),
                option.getLabel(),
                option.getText(),
                option.isCorrect(),
                option.getMisconceptionCode());
    }
}
