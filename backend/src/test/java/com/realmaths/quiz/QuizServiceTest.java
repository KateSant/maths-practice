package com.realmaths.quiz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.realmaths.common.ApiException;
import com.realmaths.config.RealMathsProperties;
import com.realmaths.game.GameService;
import com.realmaths.question.AnswerOption;
import com.realmaths.question.AnswerType;
import com.realmaths.question.Question;
import com.realmaths.question.QuestionCatalogService;
import com.realmaths.quiz.dto.AnswerResult;
import com.realmaths.quiz.dto.SubmitAnswerRequest;
import com.realmaths.support.Fixtures;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Grading, which is the one thing a student cannot be allowed to get away with.
 *
 * <p>Every case here goes through {@code submitAnswer} rather than a grading helper, because the
 * interesting behaviour is the whole path: which field the answer is read from, what that is
 * compared against, and what it does to the score and the streak. The tick-all rules in particular
 * are about what counts as <em>wrong</em>, and the tests that matter most are the ones where a
 * plausible-looking answer - most of the right boxes ticked - is still not correct.
 */
@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    private static final long USER_ID = 7L;
    private static final long SESSION_ID = 42L;
    private static final int POINTS_PER_CORRECT = 10;
    private static final Instant NOW = Instant.parse("2026-01-01T09:00:00Z");

    @Mock
    private QuizSessionRepository sessionRepository;

    @Mock
    private QuizAnswerRepository answerRepository;

    @Mock
    private QuestionCatalogService catalogService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private GameService gameService;

    private QuizService quizService;

    /** The answer the service actually persisted, for the tests that need to read it back. */
    private QuizAnswer lastSaved;

    @BeforeEach
    void setUp() {
        quizService = new QuizService(
                sessionRepository,
                answerRepository,
                catalogService,
                userRepository,
                properties(),
                gameService,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // ------------------------------------------------------------- single choice ---

    @Test
    void marksASingleChoiceAnswerCorrectWhenTheRightOptionIsChosen() {
        Question question = Fixtures.question(1L, "What is 2 + 2?", 0, "4", "5", "6");
        QuizSession session = givenAnUnansweredQuestion(question);

        AnswerResult result = answer(question, optionId(question, 0));

        assertThat(result.correct()).isTrue();
        assertThat(result.answerType()).isEqualTo(AnswerType.SINGLE_CHOICE);
        assertThat(result.correctOptionIds()).containsExactly(optionId(question, 0));
        assertThat(result.pointsAwarded()).isEqualTo(POINTS_PER_CORRECT);
        assertThat(session.getUser().getPoints()).isEqualTo(POINTS_PER_CORRECT);
        assertThat(session.getUser().getCurrentStreak()).isEqualTo(1);
    }

    @Test
    void marksASingleChoiceAnswerWrongWhenAnotherOptionIsChosen() {
        Question question = Fixtures.question(1L, "What is 2 + 2?", 0, "4", "5", "6");
        QuizSession session = givenAnUnansweredQuestion(question);

        AnswerResult result = answer(question, optionId(question, 1));

        assertThat(result.correct()).isFalse();
        assertThat(result.pointsAwarded()).isZero();
        assertThat(session.getUser().getPoints()).isZero();
        // The right answer is still revealed, which is the whole point of the reveal.
        assertThat(result.correctOptionIds()).containsExactly(optionId(question, 0));
    }

    @Test
    void refusesASingleChoiceAnswerWithNoOptionChosen() {
        Question question = Fixtures.question(1L, "What is 2 + 2?", 0, "4", "5", "6");
        givenAnUnansweredQuestion(question);

        assertThatThrownBy(() -> quizService.submitAnswer(
                        USER_ID, SESSION_ID, new SubmitAnswerRequest(question.getId(), null, null, 900)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Choose an option");
    }

    // ------------------------------------------------------- tick all that apply ---

    @Test
    void marksATickAllAnswerCorrectWhenEveryCorrectOptionIsTicked() {
        Question question = tickAllQuestion();
        QuizSession session = givenAnUnansweredQuestion(question);

        AnswerResult result = answer(question, optionIds(question, 1, 2, 4));

        assertThat(result.correct()).isTrue();
        assertThat(result.answerType()).isEqualTo(AnswerType.MULTI_SELECT);
        assertThat(result.correctOptionIds()).containsExactly(optionId(question, 1), optionId(question, 2),
                optionId(question, 4));
        assertThat(session.getUser().getPoints()).isEqualTo(POINTS_PER_CORRECT);
    }

    /** Ticking order is not part of the answer; the options come back in the question's order. */
    @Test
    void marksATickAllAnswerCorrectRegardlessOfTheOrderItWasTicked() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        assertThat(answer(question, optionIds(question, 4, 1, 2)).correct()).isTrue();
    }

    @Test
    void marksATickAllAnswerWrongWhenACorrectOptionIsMissed() {
        Question question = tickAllQuestion();
        QuizSession session = givenAnUnansweredQuestion(question);

        AnswerResult result = answer(question, optionIds(question, 1, 2));

        assertThat(result.correct()).isFalse();
        assertThat(session.getUser().getPoints()).isZero();
        assertThat(session.getUser().getCurrentStreak()).isZero();
    }

    /**
     * The severity that was chosen deliberately: a tick-all answer is the whole set, so an extra
     * tick is wrong even though every correct option is there.
     */
    @Test
    void marksATickAllAnswerWrongWhenAnExtraOptionIsTicked() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        assertThat(answer(question, optionIds(question, 0, 1, 2, 4)).correct()).isFalse();
    }

    @Test
    void marksATickAllAnswerWrongWhenNothingIsTicked() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        AnswerResult result = answer(question, List.of());

        assertThat(result.correct()).isFalse();
        // Still a real answer, so it is recorded rather than refused.
        verify(answerRepository).save(any(QuizAnswer.class));
    }

    /** Ticking the same box twice is not possible in the UI; a client that says so is not punished twice. */
    @Test
    void countsARepeatedOptionIdOnlyOnce() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        List<Long> repeated = List.of(optionId(question, 1), optionId(question, 1), optionId(question, 2),
                optionId(question, 4));

        assertThat(answer(question, repeated).correct()).isTrue();
    }

    @Test
    void revealsEveryCorrectOptionForATickAllQuestion() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        AnswerResult result = answer(question, optionIds(question, 0));

        assertThat(result.correctOptionIds())
                .as("the reveal is the whole key, not just the option the student missed")
                .containsExactly(optionId(question, 1), optionId(question, 2), optionId(question, 4));
    }

    // ----------------------------------------------------------- the same answer ---

    @Test
    void refusesAnOptionThatIsNotPartOfTheQuestion() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        assertThatThrownBy(() -> quizService.submitAnswer(
                        USER_ID, SESSION_ID, new SubmitAnswerRequest(question.getId(), null, List.of(9999L), 900)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("does not belong");
    }

    @Test
    void refusesToGradeAQuestionThatIsNotInTheRound() {
        Question question = tickAllQuestion();
        givenAnUnansweredQuestion(question);

        assertThatThrownBy(() -> quizService.submitAnswer(
                        USER_ID, SESSION_ID, new SubmitAnswerRequest(9999L, null, List.of(optionId(question, 1)), 900)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not part of this round");
    }

    /**
     * A misconfigured question has no correct options, so an empty selection would equal the empty
     * key and be marked right - full marks for ticking nothing. The publish gate makes this
     * unreachable, which is exactly why it would never be noticed if it did happen.
     */
    @Test
    void neverMarksAMisconfiguredQuestionCorrect() {
        Question question = Fixtures.multiSelectQuestion(
                1L, Fixtures.topic(1L, "number", "Number"), "Tick every prime.", "Because.", new int[] {},
                "21", "39");
        givenAnUnansweredQuestion(question);

        assertThat(answer(question, List.of()).correct()).isFalse();
    }

    /** A retried request - flaky wifi, a double click on Check - must not pay twice. */
    @Test
    void reSubmittingAQuestionReturnsTheOriginalGradeAndPaysNothingExtra() {
        Question question = tickAllQuestion();
        QuizSession session = givenAnUnansweredQuestion(question);

        AnswerResult first = answer(question, optionIds(question, 1, 2, 4));
        assertThat(first.correct()).isTrue();

        int pointsAfterFirst = session.getUser().getPoints();
        QuizAnswer stored = lastSaved;
        assertThat(stored).as("the answer should have been recorded").isNotNull();

        when(answerRepository.findBySessionIdAndQuestionId(SESSION_ID, question.getId()))
                .thenReturn(Optional.of(stored));

        AnswerResult second = answer(question, optionIds(question, 0));

        assertThat(second.correct()).isTrue();
        assertThat(second.pointsAwarded()).isEqualTo(POINTS_PER_CORRECT);
        assertThat(session.getUser().getPoints())
                .as("points are not awarded a second time")
                .isEqualTo(pointsAfterFirst);
        assertThat(session.getCorrectCount()).as("the score is not counted twice").isEqualTo(1);
    }

    // ------------------------------------------------------------------ helpers ---

    /** The seeded shape: five options with two composites and three primes. */
    private static Question tickAllQuestion() {
        return Fixtures.multiSelectQuestion(
                1L,
                Fixtures.topic(1L, "number", "Number"),
                "Tick every number below that is prime.",
                "Because.",
                new int[] {1, 2, 4},
                "21",
                "29",
                "37",
                "39",
                "47");
    }

    private static Long optionId(Question question, int index) {
        return question.getOptions().get(index).getId();
    }

    private static List<Long> optionIds(Question question, int... indexes) {
        return java.util.Arrays.stream(indexes)
                .mapToObj(index -> optionId(question, index))
                .toList();
    }

    /**
     * Wires up the repository so this question is unanswered and part of a live round.
     *
     * <p>The stubs past the session lookup are lenient because the tests that expect a refusal
     * never reach them - the refusal happens before the lookup, or before the save - and a strict
     * stub would flag the set-up of a path the test is deliberately not taking.
     */
    private QuizSession givenAnUnansweredQuestion(Question question) {
        User user = Fixtures.user(USER_ID, "student@example.com", "Student");
        QuizSession session = Fixtures.session(SESSION_ID, user, question.getTopic(), List.of(question));

        when(sessionRepository.findByIdForUser(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));
        lenient()
                .when(answerRepository.findBySessionIdAndQuestionId(SESSION_ID, question.getId()))
                .thenReturn(Optional.empty());
        // Return what was saved, so the counters the result reports come off the stored answer,
        // and keep a handle on it so a test can ask what was recorded.
        lenient()
                .when(answerRepository.save(any(QuizAnswer.class)))
                .thenAnswer(call -> {
                    lastSaved = call.getArgument(0);
                    return lastSaved;
                });
        lenient().when(answerRepository.countBySessionId(SESSION_ID)).thenReturn(1L);
        return session;
    }

    private AnswerResult answer(Question question, Long optionId) {
        return quizService.submitAnswer(
                USER_ID, SESSION_ID, new SubmitAnswerRequest(question.getId(), optionId, null, 900));
    }

    private AnswerResult answer(Question question, List<Long> optionIds) {
        return quizService.submitAnswer(
                USER_ID, SESSION_ID, new SubmitAnswerRequest(question.getId(), null, optionIds, 900));
    }

    private static RealMathsProperties properties() {
        return new RealMathsProperties(
                new RealMathsProperties.Jwt("secret", "realmaths", Duration.ofHours(12)),
                new RealMathsProperties.Cors(List.of("http://localhost:5174")),
                new RealMathsProperties.Quiz(5, 20, POINTS_PER_CORRECT),
                new RealMathsProperties.Game(20, 60, 30),
                new RealMathsProperties.Google("", List.of()));
    }

    /** Guard: the wrong-answer tests only mean something if the key really is what they assume. */
    @Test
    void theTickAllFixtureHasTheKeyTheOtherTestsAssume() {
        Question question = tickAllQuestion();

        assertThat(question.getAnswerType()).isEqualTo(AnswerType.MULTI_SELECT);
        assertThat(question.correctOptions().stream().map(AnswerOption::getText))
                .containsExactly("29", "37", "47");
        assertThat(optionId(question, 0)).as("options need ids for set grading").isNotNull();
    }
}
