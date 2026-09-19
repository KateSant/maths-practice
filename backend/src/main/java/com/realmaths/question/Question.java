package com.realmaths.question;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    /** 1 = easy up to 5 = hard. Will drive student levels later. */
    @Column(nullable = false)
    private int difficulty;

    @Column(nullable = false)
    private boolean active = true;

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

    public boolean isActive() {
        return active;
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
