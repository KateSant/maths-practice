package com.realmaths.game;

import com.realmaths.common.ApiException;
import com.realmaths.config.RealMathsProperties;
import com.realmaths.game.dto.GameStatusView;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Play time: the currency the reward level costs.
 *
 * Students earn seconds by finishing quizzes ({@link #earnedFor}) and spend them in the game. The
 * spending is deliberately server-side and heartbeat-shaped. A client that simply told us how long
 * it had been playing could be edited to say anything, so instead the client only ever says "still
 * here", and we bill the wall-clock time since the previous call against the stored balance.
 */
@Service
public class GameService {

    private final UserRepository userRepository;
    private final RealMathsProperties properties;
    private final Clock clock;

    public GameService(UserRepository userRepository, RealMathsProperties properties, Clock clock) {
        this.userRepository = userRepository;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GameStatusView status(Long userId) {
        return GameStatusView.from(require(userId), properties);
    }

    /**
     * Bills the time since the last heartbeat and returns what is left. Called while the level is
     * on screen, and once more as it is closed.
     */
    @Transactional
    public GameStatusView heartbeat(Long userId) {
        User user = require(userId);
        Instant now = clock.instant();
        Instant previous = user.getPlayHeartbeatAt();

        if (previous != null) {
            // Capped: a student who closes the tab and comes back an hour later should lose the
            // gap, not their whole balance. See maxHeartbeatGapSeconds.
            long elapsed = Math.max(0, Duration.between(previous, now).toSeconds());
            user.spendPlaySeconds((int) Math.min(elapsed, properties.game().maxHeartbeatGapSeconds()));
        }

        // At zero the clock stops, so the break before the next quiz is not billed against the
        // time that quiz is about to earn.
        user.setPlayHeartbeatAt(user.getPlaySeconds() > 0 ? now : null);
        return GameStatusView.from(user, properties);
    }

    /**
     * Seconds earned by a finished quiz: a flat rate per correct answer, plus a bonus for a clean
     * sweep, so getting them right is what pays and a perfect quiz is worth chasing.
     */
    public int earnedFor(int correctCount, int questionCount) {
        if (correctCount <= 0) {
            return 0;
        }
        int earned = correctCount * properties.game().secondsPerCorrectAnswer();
        if (questionCount > 0 && correctCount == questionCount) {
            earned += properties.game().perfectBonusSeconds();
        }
        return earned;
    }

    private User require(Long userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "That account no longer exists."));
    }
}
