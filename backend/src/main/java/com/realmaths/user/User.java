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
import java.time.LocalDate;
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

    /** Correct answers in a row. Shown in the quiz as "4 in a row", never as the student's streak. */
    @Column(name = "current_streak", nullable = false)
    private int currentStreak;

    @Column(name = "best_streak", nullable = false)
    private int bestStreak;

    /** Weeks in a row with at least one finished set: the streak a student actually sees. */
    @Column(name = "streak_weeks", nullable = false)
    private int streakWeeks;

    @Column(name = "best_streak_weeks", nullable = false)
    private int bestStreakWeeks;

    /**
     * The Monday of the last week this student finished a set in, as YYYY-MM-DD, or null if they
     * never have. A String rather than a LocalDate because the column is TEXT in SQLite and this
     * keeps the mapping unambiguous.
     */
    @Column(name = "last_practised_week", length = 10)
    private String lastPractisedWeek;

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

    /** A wrong answer breaks the current run but never the best one. */
    public void recordIncorrectAnswer() {
        this.currentStreak = 0;
    }

    /**
     * Stamps the week a set was finished in and walks the weekly run forward.
     *
     * <p>Called once per completed set; the caller is responsible for not calling it twice for the
     * same one. Two sets in a week is one week, which is the point - the streak is about turning up,
     * not about volume.
     */
    public void recordPractisedWeek(LocalDate weekStart) {
        String week = weekStart.toString();
        if (week.equals(lastPractisedWeek)) {
            return;
        }

        boolean consecutive = lastPractisedWeek != null && week.equals(nextWeekAfter(lastPractisedWeek));
        streakWeeks = consecutive ? streakWeeks + 1 : 1;
        lastPractisedWeek = week;
        bestStreakWeeks = Math.max(bestStreakWeeks, streakWeeks);
    }

    /**
     * The weekly streak as it should be displayed.
     *
     * <p>Zero once a whole week has gone by with nothing, rather than whatever the number last
     * reached - a run that lapsed three weeks ago should not still be on screen. Practising this
     * week or last week keeps it alive, so the number does not read as broken every Monday morning.
     */
    public int streakWeeksAsOf(LocalDate today) {
        if (lastPractisedWeek == null) {
            return 0;
        }

        LocalDate lastWeek = LocalDate.parse(lastPractisedWeek);
        return lastWeek.isBefore(WeeklyStreak.weekStart(today).minusWeeks(1)) ? 0 : streakWeeks;
    }

    private static String nextWeekAfter(String week) {
        return LocalDate.parse(week).plusWeeks(1).toString();
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

    /** Longest run of weeks, which survives a reset. */
    public int getBestStreakWeeks() {
        return bestStreakWeeks;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
