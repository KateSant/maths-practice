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
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
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

    /**
     * What the student chose: one option for a single choice, several for a tick-all, and none for
     * a question they never answered.
     *
     * <p>A {@code Set} rather than the {@code List} the rest of the codebase uses for collections,
     * and that is load-bearing rather than tidiness. A single answer can belong to at most each
     * option once, and Hibernate refuses to fetch two bags at once - "cannot simultaneously fetch
     * multiple bags" - which is what {@code findDetailedBySessionId} was doing when it fetched this
     * alongside the question's options.
     *
     * <p>Loaded by subselect rather than fetched, and that is load-bearing too. Joining this
     * <em>and</em> the question's options multiplies the rows - three options against two selections
     * is six - and a bag is populated from every row it appears on, so the question's option list
     * came back with each correct answer listed twice. Mocked tests structurally could not see that,
     * because there is no join to go wrong: {@code QuizApiTest} does. A subselect loads them all in
     * one extra query, which is what a review screen wants anyway, since it renders every question
     * in the round.
     *
     * <p>An empty set is an unanswered question. That state never reached the database before,
     * because the old single column was nullable and null meant the same thing.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @Fetch(FetchMode.SUBSELECT)
    @JoinTable(
            name = "quiz_answer_options",
            joinColumns = @JoinColumn(name = "answer_id"),
            inverseJoinColumns = @JoinColumn(name = "option_id"))
    private Set<AnswerOption> selectedOptions = new LinkedHashSet<>();

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
            QuizSession session,
            Question question,
            Collection<AnswerOption> selectedOptions,
            boolean correct,
            Integer timeMs,
            Instant answeredAt) {
        this.session = session;
        this.question = question;
        this.selectedOptions.addAll(selectedOptions);
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

    public List<AnswerOption> getSelectedOptions() {
        return List.copyOf(selectedOptions);
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
