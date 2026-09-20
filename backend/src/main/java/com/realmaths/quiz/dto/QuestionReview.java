package com.realmaths.quiz.dto;

import com.realmaths.question.AnswerOption;
import com.realmaths.question.AnswerType;
import com.realmaths.question.Question;
import com.realmaths.quiz.QuizAnswer;
import java.util.Comparator;
import java.util.List;

/**
 * One line of the review screen: what was asked, what was written, and what was right.
 *
 * <p>Both sides are lists, because a tick-all answer is a set. Presenting the two as the same shape
 * is what lets the review screen render them with one piece of markup instead of branching on the
 * answer type.
 *
 * <p>{@code selectedOptions} is empty for a question that was never answered, which is a real state
 * on an abandoned review screen rather than an error.
 */
public record QuestionReview(
        Long questionId,
        String prompt,
        AnswerType answerType,
        List<ReviewOption> selectedOptions,
        boolean correct,
        List<ReviewOption> correctOptions,
        String explanation) {

    /** An option as the review shows it: the letter and the words, never the id. */
    public record ReviewOption(String label, String text) {

        static ReviewOption from(AnswerOption option) {
            return new ReviewOption(option.getLabel(), option.getText());
        }
    }

    public static QuestionReview from(QuizAnswer answer) {
        Question question = answer.getQuestion();

        return new QuestionReview(
                question.getId(),
                question.getPrompt(),
                question.getAnswerType(),
                inPositionOrder(answer.getSelectedOptions()),
                answer.isCorrect(),
                inPositionOrder(question.correctOptions()),
                question.getExplanation());
    }

    /**
     * Re-sorted into the order the question showed them, so the review reads down the same list the
     * student answered. The selection arrives in whatever order the rows came back, and for a
     * tick-all question that is not meaningful.
     */
    private static List<ReviewOption> inPositionOrder(List<AnswerOption> options) {
        return options.stream()
                .sorted(Comparator.comparingInt(AnswerOption::getPosition))
                .map(ReviewOption::from)
                .toList();
    }
}
