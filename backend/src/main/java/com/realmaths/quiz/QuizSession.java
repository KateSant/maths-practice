package com.realmaths.quiz;

import com.realmaths.question.Question;
import com.realmaths.question.Topic;
import com.realmaths.user.User;
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
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "quiz_sessions")
public class QuizSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // See User.id for why this override is needed on SQLite.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Null means "mixed topics". */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id")
    private Topic topic;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    @Column(name = "correct_count", nullable = false)
    private int correctCount;

    @Column(name = "points_awarded", nullable = false)
    private int pointsAwarded;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /**
     * The questions dealt in this session, so an answer can be validated against
     * the session rather than accepted for any question in the bank. The position
     * column preserves the order the student was shown.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "quiz_session_questions",
            joinColumns = @JoinColumn(name = "session_id"),
            inverseJoinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "position")
    private List<Question> questions = new ArrayList<>();

    protected QuizSession() {
        // for JPA
    }

    public QuizSession(User user, Topic topic, Instant startedAt) {
        this.user = user;
        this.topic = topic;
        this.startedAt = startedAt;
    }

    public void addQuestions(List<Question> picked) {
        this.questions.addAll(picked);
        this.questionCount = this.questions.size();
    }

    public void recordCorrect(int points) {
        this.correctCount += 1;
        this.pointsAwarded += points;
    }

    public void complete(Instant when) {
        this.completedAt = when;
    }

    public boolean isCompleted() {
        return completedAt != null;
    }

    public boolean includesQuestion(Long questionId) {
        return questions.stream().anyMatch(q -> q.getId().equals(questionId));
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Topic getTopic() {
        return topic;
    }

    public int getQuestionCount() {
        return questionCount;
    }

    public int getCorrectCount() {
        return correctCount;
    }

    public int getPointsAwarded() {
        return pointsAwarded;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public List<Question> getQuestions() {
        return questions;
    }
}
