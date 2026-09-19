package com.realmaths.question;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "answer_options")
public class AnswerOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // See User.id for why this override is needed on SQLite.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false, length = 4)
    private String label;

    @Column(nullable = false, length = 500)
    private String text;

    /**
     * Stays on the server. The API never serialises an entity directly, precisely
     * so this flag cannot leak to a student poking at the network tab.
     */
    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    protected AnswerOption() {
        // for JPA
    }

    public AnswerOption(Question question, int position, String label, String text, boolean correct) {
        this.question = question;
        this.position = position;
        this.label = label;
        this.text = text;
        this.correct = correct;
    }

    public Long getId() {
        return id;
    }

    public Question getQuestion() {
        return question;
    }

    public int getPosition() {
        return position;
    }

    public String getLabel() {
        return label;
    }

    public String getText() {
        return text;
    }

    public boolean isCorrect() {
        return correct;
    }
}
