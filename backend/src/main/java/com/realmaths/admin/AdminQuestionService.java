package com.realmaths.admin;

import com.realmaths.admin.dto.AdminQuestionDetail;
import com.realmaths.admin.dto.AdminQuestionSummary;
import com.realmaths.admin.dto.PageResponse;
import com.realmaths.admin.dto.SaveQuestionRequest;
import com.realmaths.common.ApiException;
import com.realmaths.common.ApiValidationException;
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
                yearGroupOrFirst(request.yearGroup()));

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
                yearGroupOrFirst(request.yearGroup()));

        // The replacement options occupy the same (question_id, position) pairs as the rows being
        // removed, and the partial unique index is checked per statement. Without this flush the
        // inserts are attempted before the deletes and every edit fails.
        question.clearOptions();
        questions.flush();

        applyOptions(question, request.options());
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

    private void applyOptions(Question question, List<SaveQuestionRequest.OptionDraft> drafts) {
        List<SaveQuestionRequest.OptionDraft> submitted = drafts == null ? List.of() : drafts;

        if (submitted.size() > QuestionValidator.MAX_OPTIONS) {
            // Defence in depth. @Size covers the HTTP path, but a CSV importer calling this
            // service directly would not pass through bean validation.
            throw new ApiValidationException(
                    "That is more options than a question can hold.",
                    Map.of("options", "A question can have at most " + QuestionValidator.MAX_OPTIONS + " options."));
        }

        for (int index = 0; index < submitted.size(); index++) {
            // Labels are derived from position, never accepted from the client, so the two
            // cannot end up disagreeing.
            String label = String.valueOf((char) ('A' + index));
            question.addOption(label, submitted.get(index).text(), submitted.get(index).correct());
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
}
