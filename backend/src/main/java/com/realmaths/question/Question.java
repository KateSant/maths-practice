package com.realmaths.question;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "questions")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // See User.id for why this override is needed on SQLite.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false)
    private Topic topic;

    @Column(nullable = false, length = 1000)
    private String prompt;

    @Column(length = 1000)
    private String explanation;

    /** The band this question sits in, 1 (easiest) to 4 (hardest). The words for them live in the frontend. */
    @Column(nullable = false)
    private int difficulty;

    /**
    /**
     * The school year this question belongs to, 7 to 13. See {@link YearGroups}.
     *
     * <p>This decides which sets a student may be dealt: a quiz started at Year 8 draws only
     * Year 8 questions. It is a property of the content rather than of the student, so nothing
     * about a student's account records a year group and changing the dropdown changes the
     * questions rather than the person.
     */
    @Column(name = "year_group", nullable = false)
    private int yearGroup;

    /**
     * How the question is answered and graded. Defaults to the single-choice behaviour every
     * question had before this column existed, which is what makes the migration backfill-free.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "answer_type", nullable = false, length = 20)
    private AnswerType answerType = AnswerType.SINGLE_CHOICE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionStatus status = QuestionStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionOrigin origin = QuestionOrigin.AUTHORED;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position asc")
    private List<AnswerOption> options = new ArrayList<>();

    protected Question() {
        // for JPA
    }

    /**
     * Both classifications are constructor arguments rather than defaults plus setters, so a new
     * question cannot be created as one type or year and quietly left as another. Callers that
     * want the ordinary behaviour pass {@link AnswerType#SINGLE_CHOICE} and say so.
     */
    public Question(
            Topic topic, String prompt, String explanation, int difficulty, int yearGroup, AnswerType answerType) {
        this.topic = topic;
        this.prompt = prompt;
        this.explanation = explanation;
        this.difficulty = difficulty;
        this.yearGroup = yearGroup;
        this.answerType = answerType == null ? AnswerType.SINGLE_CHOICE : answerType;
    }

    public void addOption(String label, String text, boolean correct) {
        options.add(new AnswerOption(this, options.size() + 1, label, text, correct));
    }

    /**
     * Empties the option set so it can be rebuilt.
     *
     * <p>Callers must flush between clearing and re-adding. The new options occupy the same
     * {@code (question_id, position)} values as the old ones, so unless the deletes reach the
     * database first the partial unique index rejects the inserts.
     */
    public void clearOptions() {
        options.clear();
    }

    /** Applies an edit to the parts a teacher can change. Options are handled separately. */
    public void revise(
            Topic topic, String prompt, String explanation, int difficulty, int yearGroup, AnswerType answerType) {
        this.topic = topic;
        this.prompt = prompt;
        this.explanation = explanation;
        this.difficulty = difficulty;
        this.yearGroup = yearGroup;
        this.answerType = answerType == null ? AnswerType.SINGLE_CHOICE : answerType;
    }

    public void setStatus(QuestionStatus status) {
        this.status = status;
    }

    public void setOrigin(QuestionOrigin origin) {
        this.origin = origin;
    }

    public Long getId() {
        return id;
    }

    public Topic getTopic() {
        return topic;
    }

    public String getPrompt() {
        return prompt;
    }

    public String getExplanation() {
        return explanation;
    }

    public int getDifficulty() {
        return difficulty;
    }

    /** The school year this question is written for, 7 to 13. */
    public int getYearGroup() {
        return yearGroup;
    }

    public AnswerType getAnswerType() {
        return answerType;
    }

    /** True when this question may be served to students. */
    public boolean isPublished() {
        return status == QuestionStatus.PUBLISHED;
    }

    public QuestionStatus getStatus() {
        return status;
    }

    public QuestionOrigin getOrigin() {
        return origin;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<AnswerOption> getOptions() {
        return options;
    }

    /**
     * Every correct option, in position order.
     *
     * <p>A list rather than one option, because a tick-all question has several. A single-choice
     * question is simply the case where this returns exactly one, which is what lets the grading
     * rule be the same set comparison for both types. Empty means the question is misconfigured,
     * and the validator refuses to publish one of those.
     */
    public List<AnswerOption> correctOptions() {
        return options.stream().filter(AnswerOption::isCorrect).toList();
    }
}
