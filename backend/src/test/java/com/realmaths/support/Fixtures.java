package com.realmaths.support;

import static org.springframework.test.util.ReflectionTestUtils.setField;

import com.realmaths.question.AnswerOption;
import com.realmaths.question.Question;
import com.realmaths.question.Topic;
import com.realmaths.quiz.QuizAnswer;
import com.realmaths.quiz.QuizSession;
import com.realmaths.user.User;
import java.time.Instant;
import java.util.List;

/**
 * Builds entities with ids for service tests. JPA generates ids in production, so
 * the reflection lives here and nowhere else.
 */
public final class Fixtures {

    private Fixtures() {}

    public static Topic topic(long id, String slug, String name) {
        Topic topic = new Topic(slug, name, "Test topic " + slug, (int) id);
        setField(topic, "id", id);
        return topic;
    }

    /** @param correctIndex zero-based index into {@code optionTexts} */
    public static Question question(long id, Topic topic, String prompt, String explanation, int correctIndex,
            String... optionTexts) {
        Question question = new Question(topic, prompt, explanation, 1);
        setField(question, "id", id);
        for (int i = 0; i < optionTexts.length; i++) {
            question.addOption(String.valueOf((char) ('A' + i)), optionTexts[i], i == correctIndex);
        }
        return question;
    }

    public static Question question(long id, String prompt, int correctIndex, String... optionTexts) {
        return question(id, topic(1L, "number", "Number"), prompt, "Because.", correctIndex, optionTexts);
    }

    public static User user(long id, String email, String displayName) {
        User user = new User(email, "hashed-password", displayName);
        setField(user, "id", id);
        return user;
    }

    /** A user who has already earned some points, so streaks can be exercised. */
    public static User userWithProgress(long id, int points, int currentStreak, int bestStreak) {
        User user = user(id, "learner" + id + "@example.com", "Learner " + id);
        setField(user, "points", points);
        setField(user, "currentStreak", currentStreak);
        setField(user, "bestStreak", bestStreak);
        return user;
    }

    public static QuizSession session(long id, User user, Topic topic, List<Question> questions) {
        QuizSession session = new QuizSession(user, topic, Instant.parse("2026-01-01T09:00:00Z"));
        setField(session, "id", id);
        session.addQuestions(questions);
        return session;
    }

    public static QuizAnswer answer(QuizSession session, Question question, AnswerOption selected, boolean correct) {
        return new QuizAnswer(session, question, selected, correct, 1_000, Instant.parse("2026-01-01T09:00:30Z"));
    }
}
