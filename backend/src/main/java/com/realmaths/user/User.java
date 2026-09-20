package com.realmaths.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // SQLite requires AUTOINCREMENT columns to be declared exactly INTEGER, because
    // that is what makes them an alias for the 64-bit rowid. Our Java type is Long,
    // so tell Hibernate to expect an integer column and keep ddl-auto=validate passing.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.STUDENT;

    @Column(nullable = false)
    private int points;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak;

    @Column(name = "best_streak", nullable = false)
    private int bestStreak;

    /** Unspent seconds of time in the reward game. Earned by finishing quizzes, spent by playing. */
    @Column(name = "play_seconds", nullable = false)
    private int playSeconds;

    /**
     * When the game last reported in, or null when nobody is playing. The balance is only ever
     * spent against this: the server bills the elapsed wall-clock time, so the client cannot award
     * itself anything - it can only tell us it is still there.
     */
    @Column(name = "play_heartbeat_at")
    private Instant playHeartbeatAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected User() {
        // for JPA
    }

    public User(String email, String displayName) {
        this.email = email;
        this.displayName = displayName;
        this.role = Role.STUDENT;
    }

    /** Awards points and walks the streak forward after a correct answer. */
    public void recordCorrectAnswer(int points) {
        this.points += points;
        this.currentStreak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    }

    /** A wrong answer breaks the current streak but never the best one. */
    public void recordIncorrectAnswer() {
        this.currentStreak = 0;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public int getPoints() {
        return points;
    }

    public int getCurrentStreak() {
        return currentStreak;
    }

    public int getBestStreak() {
        return bestStreak;
    }

    /**
     * Adds time earned by finishing a quiz. Called once per completed session: completing the same
     * quiz twice must not pay out twice.
     */
    public void awardPlaySeconds(int seconds) {
        if (seconds > 0) {
            this.playSeconds += seconds;
        }
    }

    public int getPlaySeconds() {
        return playSeconds;
    }

    /** Spends up to {@code seconds} of play time, returning how much was actually spent. */
    public int spendPlaySeconds(int seconds) {
        int spent = Math.min(Math.max(seconds, 0), playSeconds);
        this.playSeconds -= spent;
        return spent;
    }

    public Instant getPlayHeartbeatAt() {
        return playHeartbeatAt;
    }

    /**
     * Records that the game is (or is no longer) in play. Passing null stops the clock, which is
     * what makes the next session start from a fresh heartbeat rather than billing the break.
     */
    public void setPlayHeartbeatAt(Instant at) {
        this.playHeartbeatAt = at;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
