package com.realmaths.quiz;

import com.realmaths.question.AnswerOption;
import com.realmaths.question.Question;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "quiz_answers")
public class QuizAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // See User.id for why this override is needed on SQLite.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private QuizSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    /** Nullable so a future "skip" feature can record an unanswered question. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "selected_option_id")
    private AnswerOption selectedOption;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(name = "time_ms")
    private Integer timeMs;

    @Column(name = "answered_at", nullable = false)
    private Instant answeredAt;

    protected QuizAnswer() {
        // for JPA
    }

    public QuizAnswer(
            QuizSession session, Question question, AnswerOption selectedOption, boolean correct, Integer timeMs,
            Instant answeredAt) {
        this.session = session;
        this.question = question;
        this.selectedOption = selectedOption;
        this.correct = correct;
        this.timeMs = timeMs;
        this.answeredAt = answeredAt;
    }

    public Long getId() {
        return id;
    }

    public QuizSession getSession() {
        return session;
    }

    public Question getQuestion() {
        return question;
    }

    public AnswerOption getSelectedOption() {
        return selectedOption;
    }

    public boolean isCorrect() {
        return correct;
    }

    public Integer getTimeMs() {
        return timeMs;
    }

    public Instant getAnsweredAt() {
        return answeredAt;
    }
}
