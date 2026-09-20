package com.realmaths.quiz;

import com.realmaths.common.ApiException;
import com.realmaths.config.RealMathsProperties;
import com.realmaths.game.GameService;
import com.realmaths.question.AnswerOption;
import com.realmaths.question.DifficultyBand;
import com.realmaths.question.Question;
import com.realmaths.question.QuestionCatalogService;
import com.realmaths.question.Topic;
import com.realmaths.question.YearGroups;
import com.realmaths.quiz.dto.AnswerResult;
import com.realmaths.quiz.dto.QuizHistoryItem;
import com.realmaths.quiz.dto.QuizSessionView;
import com.realmaths.quiz.dto.SessionSummary;
import com.realmaths.quiz.dto.StartQuizRequest;
import com.realmaths.quiz.dto.SubmitAnswerRequest;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

    private final QuizSessionRepository sessionRepository;
    private final QuizAnswerRepository answerRepository;
    private final QuestionCatalogService catalogService;
    private final UserRepository userRepository;
    private final RealMathsProperties properties;
    private final GameService gameService;
    private final Clock clock;

    public QuizService(
            QuizSessionRepository sessionRepository,
            QuizAnswerRepository answerRepository,
            QuestionCatalogService catalogService,
            UserRepository userRepository,
            RealMathsProperties properties,
            GameService gameService,
            Clock clock) {
        this.sessionRepository = sessionRepository;
        this.answerRepository = answerRepository;
        this.catalogService = catalogService;
        this.userRepository = userRepository;
        this.properties = properties;
        this.gameService = gameService;
        this.clock = clock;
    }

    /** Deals a fresh set of questions and remembers them against the session. */
    @Transactional
    public QuizSessionView startSession(Long userId, StartQuizRequest request) {
        Topic topic = null;
        if (request.topicSlug() != null && !request.topicSlug().isBlank()) {
            topic = catalogService.requireTopicBySlug(request.topicSlug());
        }

        // The student's choice of year group, not a fact about them: it selects which questions
        // come back, and asking for a year above their own is allowed on purpose.
        Integer yearGroup = YearGroups.requireValid(request.yearGroup());

        Long topicId = topic == null ? null : topic.getId();
        List<Question> picked = catalogService.pickForSession(
                topicId, yearGroup, resolveQuestionCount(request.count()), targetLevelFor(userId, topicId, null));

        QuizSession session = new QuizSession(
                userRepository.getReferenceById(userId), topic, yearGroup, clock.instant());
        session.addQuestions(picked);

        return QuizSessionView.from(sessionRepository.save(session));
    }

    /**
     * Grades one answer server-side and updates points and streaks.
     *
     * Re-submitting the same question returns the original grade rather than
     * double-awarding points, so a retried request (flaky wifi, double click) is safe. That matters
     * more for a tick-all question than it did before: the student now commits by pressing a button
     * rather than by tapping an option, and a double click on that button is an ordinary thing to do.
     */
    @Transactional
    public AnswerResult submitAnswer(Long userId, Long sessionId, SubmitAnswerRequest request) {
        QuizSession session = requireSession(userId, sessionId);
        if (session.isCompleted()) {
            throw ApiException.badRequest("This round has already been finished.");
        }

        Question question = session.getQuestions().stream()
                .filter(candidate -> candidate.getId().equals(request.questionId()))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("That question is not part of this round."));

        Optional<QuizAnswer> previous = answerRepository.findBySessionIdAndQuestionId(sessionId, question.getId());
        if (previous.isPresent()) {
            return toResult(session, previous.get());
        }

        List<AnswerOption> selected = resolveSelection(question, request);
        boolean correct = isCorrect(question, selected);
        QuizAnswer answer = answerRepository.save(
                new QuizAnswer(session, question, selected, correct, request.timeMs(), clock.instant()));

        User user = session.getUser();
        if (correct) {
            int points = properties.quiz().pointsPerCorrectAnswer();
            session.recordCorrect(points);
            user.recordCorrectAnswer(points);
        } else {
            user.recordIncorrectAnswer();
        }

        return toResult(session, answer);
    }

    /**
     * Reads the answer out of whichever field the question's type deals in.
     *
     * <p>Chosen by the question, never by the request, so a client cannot change how its answer is
     * graded by populating the other field. An option that is not part of this question is refused
     * rather than ignored: it means the client is confused about what it is answering, and silently
     * dropping it would turn a bug into a wrong answer.
     */
    private static List<AnswerOption> resolveSelection(Question question, SubmitAnswerRequest request) {
        Map<Long, AnswerOption> byId = question.getOptions().stream()
                .collect(Collectors.toMap(AnswerOption::getId, Function.identity()));

        if (question.getAnswerType().isMultiSelect()) {
            List<Long> ids = request.optionIds() == null ? List.of() : request.optionIds();
            // distinct() so a client repeating an id cannot store the same option twice. The set
            // comparison below would ignore a duplicate anyway, but the answer on file should say
            // what the student did, and nobody ticks one box twice.
            return ids.stream().distinct().map(id -> requireOption(byId, id)).toList();
        }

        if (request.optionId() == null) {
            throw ApiException.badRequest("Choose an option to answer this question.");
        }
        return List.of(requireOption(byId, request.optionId()));
    }

    private static AnswerOption requireOption(Map<Long, AnswerOption> byId, Long optionId) {
        AnswerOption option = byId.get(optionId);
        if (option == null) {
            throw ApiException.badRequest("That option does not belong to the question.");
        }
        return option;
    }

    /**
     * Whether the chosen set is exactly the correct set.
     *
     * <p>One rule for both types. A single choice is simply the case where the correct set has one
     * member - the old {@code selected.isCorrect()} check is what this reduces to - so there is no
     * branch here to drift from the answer type, and a future option-based type is graded correctly
     * without being mentioned.
     *
     * <p>Missing an option is wrong and ticking an extra one is wrong, which is the intended
     * severity for a tick-all question: "some right answers" is not the same as "the right
     * answers". No partial credit, because the score and the streak are counts of questions
     * answered correctly and a half-marked question would make both mean less.
     */
    private static boolean isCorrect(Question question, List<AnswerOption> selected) {
        Set<Long> correct = question.correctOptions().stream()
                .map(AnswerOption::getId)
                .collect(Collectors.toSet());

        if (correct.isEmpty()) {
            // Refused outright rather than compared. A misconfigured question has no correct
            // answers, and an empty selection would then equal the empty key and be marked right -
            // awarding full marks for ticking nothing. The publish gate makes this unreachable,
            // but the failure mode is bad enough to be worth closing here as well.
            return false;
        }

        Set<Long> chosen = selected.stream().map(AnswerOption::getId).collect(Collectors.toSet());
        return chosen.equals(correct);
    }

    /** Finishing twice is harmless: the first completion time is kept, and play time is paid once. */
    @Transactional
    public SessionSummary completeSession(Long userId, Long sessionId) {
        QuizSession session = requireSession(userId, sessionId);
        if (!session.isCompleted()) {
            session.complete(clock.instant());
            // Paying out on completion rather than per answer means an abandoned quiz earns
            // nothing, and the "you earned X" on the results page is the whole amount at once.
            session.getUser()
                    .awardPlaySeconds(gameService.earnedFor(session.getCorrectCount(), session.getQuestionCount()));
        }
        return summaryOf(session, userId);
    }

    @Transactional(readOnly = true)
    public SessionSummary getSession(Long userId, Long sessionId) {
        QuizSession session = requireSession(userId, sessionId);
        return summaryOf(session, userId);
    }

    @Transactional(readOnly = true)
    public List<QuizHistoryItem> history(Long userId) {
        return sessionRepository.findCompletedForUser(userId).stream()
                .map(QuizHistoryItem::from)
                .toList();
    }

    private QuizSession requireSession(Long userId, Long sessionId) {
        return sessionRepository.findByIdForUser(sessionId, userId)
                .orElseThrow(() -> ApiException.notFound("Quiz session not found."));
    }

    /**
     * The level to aim at, from the student's recent answers in this topic - or across every
     * topic when the set is mixed. Answers just given count, so a summary describes the set the
     * student is about to get rather than the one they have just finished.
     *
     * <p>{@code excludeSessionId} ignores one session's answers, which is how the summary reports
     * the level a set was <em>aimed</em> at: recomputing without that set reproduces the band it
     * was dealt from, which the questions themselves cannot be trusted to say, because the window
     * is widened when the bank is thin at the target level.
     */
    private int targetLevelFor(Long userId, Long topicId, Long excludeSessionId) {
        List<QuizAnswerRepository.RecentTopicAccuracy> recent =
                answerRepository.recentAccuracyByTopic(userId, DifficultyBand.RECENT_ANSWERS, excludeSessionId);

        if (topicId == null) {
            long answered = recent.stream().mapToLong(QuizAnswerRepository.RecentTopicAccuracy::getAnswered).sum();
            long correct = recent.stream().mapToLong(QuizAnswerRepository.RecentTopicAccuracy::getCorrect).sum();
            return DifficultyBand.forAccuracy(answered, correct);
        }

        return recent.stream()
                .filter(row -> topicId.equals(row.getTopicId()))
                .findFirst()
                .map(row -> DifficultyBand.forAccuracy(row.getAnswered(), row.getCorrect()))
                // No answers in this topic yet, so there is nothing to go on.
                .orElseGet(() -> DifficultyBand.forAccuracy(0, 0));
    }

    private SessionSummary summaryOf(QuizSession session, Long userId) {
        Long topicId = session.getTopic() == null ? null : session.getTopic().getId();
        return SessionSummary.from(
                session,
                answerRepository.findDetailedBySessionId(session.getId()),
                targetLevelFor(userId, topicId, null),
                targetLevelFor(userId, topicId, session.getId()),
                playSecondsFor(session));
    }

    /**
     * Play time is recomputed rather than stored on the session: it is a function of the score and
     * the current rates, and the balance on the account is what actually gets spent.
     */
    private int playSecondsFor(QuizSession session) {
        return gameService.earnedFor(session.getCorrectCount(), session.getQuestionCount());
    }

    private AnswerResult toResult(QuizSession session, QuizAnswer answer) {
        User user = session.getUser();
        Question question = answer.getQuestion();

        return new AnswerResult(
                question.getId(),
                question.getAnswerType(),
                answer.isCorrect(),
                question.correctOptions().stream().map(AnswerOption::getId).toList(),
                question.getExplanation(),
                answer.isCorrect() ? properties.quiz().pointsPerCorrectAnswer() : 0,
                user.getPoints(),
                user.getCurrentStreak(),
                user.getBestStreak(),
                (int) answerRepository.countBySessionId(session.getId()),
                session.getCorrectCount());
    }

    private int resolveQuestionCount(Integer requested) {
        int count = requested == null ? properties.quiz().defaultQuestionCount() : requested;
        if (count < 1) {
            throw ApiException.badRequest("A round needs at least one question.");
        }
        // Silently cap rather than reject: the client asking for 500 is not an error.
        return Math.min(count, properties.quiz().maxQuestionCount());
    }
}
