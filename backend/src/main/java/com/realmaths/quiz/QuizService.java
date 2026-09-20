package com.realmaths.quiz;

import com.realmaths.common.ApiException;
import com.realmaths.config.RealMathsProperties;
import com.realmaths.question.AnswerOption;
import com.realmaths.question.DifficultyBand;
import com.realmaths.question.Question;
import com.realmaths.question.QuestionCatalogService;
import com.realmaths.question.Topic;
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
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

    private final QuizSessionRepository sessionRepository;
    private final QuizAnswerRepository answerRepository;
    private final QuestionCatalogService catalogService;
    private final UserRepository userRepository;
    private final RealMathsProperties properties;
    private final Clock clock;

    public QuizService(
            QuizSessionRepository sessionRepository,
            QuizAnswerRepository answerRepository,
            QuestionCatalogService catalogService,
            UserRepository userRepository,
            RealMathsProperties properties,
            Clock clock) {
        this.sessionRepository = sessionRepository;
        this.answerRepository = answerRepository;
        this.catalogService = catalogService;
        this.userRepository = userRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /** Deals a fresh set of questions and remembers them against the session. */
    @Transactional
    public QuizSessionView startSession(Long userId, StartQuizRequest request) {
        Topic topic = null;
        if (request.topicSlug() != null && !request.topicSlug().isBlank()) {
            topic = catalogService.requireTopicBySlug(request.topicSlug());
        }

        Long topicId = topic == null ? null : topic.getId();
        List<Question> picked = catalogService.pickForSession(
                topicId, resolveQuestionCount(request.count()), targetLevelFor(userId, topicId, null));

        QuizSession session = new QuizSession(userRepository.getReferenceById(userId), topic, clock.instant());
        session.addQuestions(picked);

        return QuizSessionView.from(sessionRepository.save(session));
    }

    /**
     * Grades one answer server-side and updates points and streaks.
     *
     * Re-submitting the same question returns the original grade rather than
     * double-awarding points, so a retried request (flaky wifi, double click) is safe.
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

        AnswerOption selected = question.getOptions().stream()
                .filter(option -> option.getId().equals(request.optionId()))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("That option does not belong to the question."));

        boolean correct = selected.isCorrect();
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

    /** Finishing twice is harmless: the first completion time is kept. */
    @Transactional
    public SessionSummary completeSession(Long userId, Long sessionId) {
        QuizSession session = requireSession(userId, sessionId);
        if (!session.isCompleted()) {
            session.complete(clock.instant());
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
                targetLevelFor(userId, topicId, session.getId()));
    }

    private AnswerResult toResult(QuizSession session, QuizAnswer answer) {
        User user = session.getUser();
        Question question = answer.getQuestion();

        return new AnswerResult(
                question.getId(),
                answer.isCorrect(),
                question.correctOption().map(AnswerOption::getId).orElse(null),
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
