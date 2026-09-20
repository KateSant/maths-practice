package com.realmaths.question.dto;

import com.realmaths.question.AnswerType;
import com.realmaths.question.Question;
import java.util.List;

/**
 * A question as a student receives it. Note there is no correctness field anywhere in this shape,
 * and no answer key: {@link AnswerOptionView} carries an id, a label and text, and nothing about
 * which one is right.
 *
 * <p>{@code answerType} is the one thing the client needs in order to render the question at all -
 * a tick-all question is answered differently from a single choice - so it is sent. It says how to
 * answer, not what the answer is.
 *
 * <p>{@code yearGroup} says which year's set the question came from, which the quiz shows so a
 * student who chose Year 10 can see they were dealt Year 10.
 */
public record QuestionView(
        Long id,
        String prompt,
        int difficulty,
        int yearGroup,
        AnswerType answerType,
        List<AnswerOptionView> options) {

    public static QuestionView from(Question question) {
        List<AnswerOptionView> options = question.getOptions().stream()
                .map(AnswerOptionView::from)
                .toList();
        return new QuestionView(
                question.getId(),
                question.getPrompt(),
                question.getDifficulty(),
                question.getYearGroup(),
                question.getAnswerType(),
                options);
    }
}
