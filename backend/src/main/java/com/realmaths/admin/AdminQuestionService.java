package com.realmaths.admin;

import com.realmaths.admin.dto.AdminQuestionDetail;
import com.realmaths.admin.dto.AdminQuestionSummary;
import com.realmaths.admin.dto.PageResponse;
import com.realmaths.admin.dto.SaveQuestionRequest;
import com.realmaths.common.ApiException;
import com.realmaths.common.ApiValidationException;
import com.realmaths.question.AnswerOption;
import com.realmaths.question.AnswerType;
import com.realmaths.question.Question;
import com.realmaths.question.QuestionOrigin;
import com.realmaths.question.QuestionRepository;
import com.realmaths.question.QuestionStatus;
import com.realmaths.question.Topic;
import com.realmaths.question.TopicRepository;
import com.realmaths.question.YearGroups;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authoring questions: the read and write side that no student can reach. */
@Service
public class AdminQuestionService {

    private final QuestionRepository questions;
    private final TopicRepository topics;
    private final QuestionValidator validator;

    public AdminQuestionService(QuestionRepository questions, TopicRepository topics, QuestionValidator validator) {
        this.questions = questions;
        this.topics = topics;
        this.validator = validator;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminQuestionSummary> list(
            Long topicId,
            QuestionStatus status,
            Integer difficulty,
            QuestionOrigin origin,
            Integer yearGroup,
            String search,
            Pageable pageable) {
        YearGroups.requireValid(yearGroup);
        Page<Question> page =
                questions.search(topicId, status, difficulty, origin, yearGroup, blankToNull(search), pageable);
        return PageResponse.of(page.map(AdminQuestionSummary::from));
    }

    @Transactional(readOnly = true)
    public AdminQuestionDetail get(long id) {
        return AdminQuestionDetail.from(requireDetailed(id));
    }

    /** Creates a draft. Nothing reaches students until it is published. */
    @Transactional
    public AdminQuestionDetail create(SaveQuestionRequest request) {
        Question question = new Question(
                requireTopic(request.topicId()),
                promptOrEmpty(request.prompt()),
                request.explanation(),
                request.difficulty(),
                yearGroupOrFirst(request.yearGroup()),
                answerTypeOrSingleChoice(request.answerType()));

        applyOptions(question, request.options());
        return AdminQuestionDetail.from(questions.saveAndFlush(question));
    }

    /** Replaces the whole question, options included. */
    @Transactional
    public AdminQuestionDetail update(long id, SaveQuestionRequest request) {
        Question question = requireDetailed(id);
        question.revise(
                requireTopic(request.topicId()),
                promptOrEmpty(request.prompt()),
                request.explanation(),
                request.difficulty(),
                yearGroupOrFirst(request.yearGroup()),
                answerTypeOrSingleChoice(request.answerType()));

        // Edited in place rather than rebuilt. A recorded answer points at an option id, and that
        // link cascades on delete, so replacing the option rows destroyed every pick already
        // recorded against the question - a typo fix wiped its misconception history. Position is
        // the option's only identity here (labels are derived from it), so an edit means updating
        // the option at each position and adding or dropping from the end.
        applyOptionsInPlace(question, request.options());
        return AdminQuestionDetail.from(questions.saveAndFlush(question));
    }

    /**
     * Makes a question live. The only place that happens, so the validator cannot be bypassed by
     * a caller that forgot about it.
     */
    @Transactional
    public AdminQuestionDetail publish(long id) {
        Question question = requireDetailed(id);
        validator.requirePublishable(question);
        question.setStatus(QuestionStatus.PUBLISHED);
        return AdminQuestionDetail.from(question);
    }

    /**
     * Takes a question out of circulation.
     *
     * <p>Retiring rather than deleting is the only removal on offer. A hard delete cascades to
     * {@code quiz_answers}, so it would erase students' answer history and the provenance of
     * their points along with the question.
     */
    @Transactional
    public AdminQuestionDetail retire(long id) {
        Question question = requireDetailed(id);
        question.setStatus(QuestionStatus.RETIRED);
        return AdminQuestionDetail.from(question);
    }

    /**
     * Applies an edit to the options in place, keeping each row and its id.
     *
     * <p>Options are matched by position, the only identity they have: labels are derived from it
     * (A-F) and {@code unique (question_id, position)} is the constraint. Submitting more options
     * than before appends; submitting fewer drops the surplus from the end.
     *
     * <p>The correct flags are cleared before they are set, because the single-choice trigger
     * refuses a second correct option per statement: moving the key from option A to option B has to
     * pass through a moment where neither is marked. That is also what makes the flags replace
     * rather than merge, which an edit must do.
     */
    private void applyOptionsInPlace(Question question, List<SaveQuestionRequest.OptionDraft> drafts) {
        List<SaveQuestionRequest.OptionDraft> submitted = requireSaneOptions(question, drafts);
        List<AnswerOption> existing = question.getOptions();

        for (AnswerOption option : existing) {
            option.markIncorrect();
        }
        questions.flush();

        for (int index = 0; index < submitted.size(); index++) {
            String label = String.valueOf((char) ('A' + index));
            SaveQuestionRequest.OptionDraft draft = submitted.get(index);
            if (index < existing.size()) {
                existing.get(index)
                        .revise(
                                draft.text(),
                                draft.correct(),
                                codeOrNull(draft),
                                blankToNull(draft.feedback()));
            } else {
                // Labels are derived from position, never accepted from the client, so the two
                // cannot end up disagreeing.
                question.addOption(
                        label, draft.text(), draft.correct(), codeOrNull(draft), blankToNull(draft.feedback()));
            }
        }

        question.truncateOptions(submitted.size());
    }

    /**
     * The checks both edit paths need, before either touches a row.
     *
     * <p>Both are defence in depth: {@code @Size} covers the HTTP path, but a CSV importer calling
     * this service directly would not pass through bean validation. The single-choice ceiling
     * matters more than the option ceiling, because the database enforces it - the
     * {@code answer_options_single_choice_insert} trigger refuses a second correct option, so
     * without this check the teacher gets an opaque 409 from a constraint violation instead of a
     * message on the offending input. Harmless for a draft that really is half-written, because a
     * draft with no correct option at all is still allowed to be saved.
     */
    private List<SaveQuestionRequest.OptionDraft> requireSaneOptions(
            Question question, List<SaveQuestionRequest.OptionDraft> drafts) {
        List<SaveQuestionRequest.OptionDraft> submitted = drafts == null ? List.of() : drafts;

        if (submitted.size() > QuestionValidator.MAX_OPTIONS) {
            throw new ApiValidationException(
                    "That is more options than a question can hold.",
                    Map.of("options", "A question can have at most " + QuestionValidator.MAX_OPTIONS + " options."));
        }

        long correct = submitted.stream().filter(SaveQuestionRequest.OptionDraft::correct).count();
        if (correct > 1 && !question.getAnswerType().isMultiSelect()) {
            throw new ApiValidationException(
                    "This question has more than one correct answer.",
                    Map.of(
                            "options.correct",
                            "A single-answer question can have only one correct option. "
                                    + "Switch it to 'tick all that apply' to mark more than one."));
        }

        return submitted;
    }

    private void applyOptions(Question question, List<SaveQuestionRequest.OptionDraft> drafts) {
        List<SaveQuestionRequest.OptionDraft> submitted = requireSaneOptions(question, drafts);

        for (int index = 0; index < submitted.size(); index++) {
            // Labels are derived from position, never accepted from the client, so the two
            // cannot end up disagreeing.
            String label = String.valueOf((char) ('A' + index));
            question.addOption(
                    label,
                    submitted.get(index).text(),
                    submitted.get(index).correct(),
                    codeOrNull(submitted.get(index)),
                    blankToNull(submitted.get(index).feedback()));
        }
    }

    private Question requireDetailed(long id) {
        return questions
                .findDetailedById(id)
                .orElseThrow(() -> ApiException.notFound("Question " + id + " does not exist."));
    }

    private Topic requireTopic(Long topicId) {
        return topics.findById(topicId)
                .orElseThrow(() -> new ApiValidationException(
                        "That topic does not exist.", Map.of("topicId", "Choose an existing topic.")));
    }

    /** An empty search box means "no filter", not "match the empty string". */
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * A misconception code that is absent or blank means "this option catches nothing", which is
     * what a correct option and an undiagnosed distractor both are. Storing "" rather than null
     * would make the two indistinguishable in a query that counts what is diagnosed.
     */
    private static String codeOrNull(SaveQuestionRequest.OptionDraft draft) {
        return blankToNull(draft.misconceptionCode());
    }

    /**
     * The prompt column is NOT NULL, but a draft is allowed to have no prompt yet, so an absent
     * prompt is stored as an empty string rather than refused.
     *
     * <p>Coercing here rather than rejecting with a 400 is deliberate: the domain distinction
     * that matters is blank versus non-blank, and that is checked on publish. Insisting on a
     * non-null prompt at the boundary would make saving an unfinished draft harder than the
     * design intends.
     */
    private static String promptOrEmpty(String prompt) {
        return prompt == null ? "" : prompt;
    }

    /**
     * An absent year group means the first year of secondary school, matching the column default.
     * Bean validation has already rejected anything outside 7..13 by the time this runs.
     */
    private static int yearGroupOrFirst(Integer yearGroup) {
        return yearGroup == null ? YearGroups.MIN : yearGroup;
    }

    /**
     * A request that names no answer type is one written before tick-all questions existed, and
     * what it means is a single choice. Defaulting keeps such a client correct rather than
     * producing a question whose type is a coin flip.
     */
    private static AnswerType answerTypeOrSingleChoice(AnswerType answerType) {
        return answerType == null ? AnswerType.SINGLE_CHOICE : answerType;
    }
}
