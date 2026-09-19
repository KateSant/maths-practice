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

    /** 1 = easy up to 5 = hard. Rendered as an ore tier in the Minecraft theme. */
    @Column(nullable = false)
    private int difficulty;

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

    public Question(Topic topic, String prompt, String explanation, int difficulty) {
        this.topic = topic;
        this.prompt = prompt;
        this.explanation = explanation;
        this.difficulty = difficulty;
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
    public void revise(Topic topic, String prompt, String explanation, int difficulty) {
        this.topic = topic;
        this.prompt = prompt;
        this.explanation = explanation;
        this.difficulty = difficulty;
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

    /** The single correct option, or empty if the question is misconfigured. */
    public java.util.Optional<AnswerOption> correctOption() {
        return options.stream().filter(AnswerOption::isCorrect).findFirst();
    }
}
