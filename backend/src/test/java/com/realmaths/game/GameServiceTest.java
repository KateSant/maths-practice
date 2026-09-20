package com.realmaths.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.realmaths.config.RealMathsProperties;
import com.realmaths.game.dto.GameStatusView;
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
 * The play-time ledger: what a quiz pays, and what a heartbeat costs.
 *
 * The billing rules are the interesting part. Time is only ever spent against a stored balance and
 * only ever in wall-clock amounts the server measures itself, so a client cannot mint time by lying
 * about how long it played - it can only say "still here".
 */
@ExtendWith(MockitoExtension.class)
class GameServiceTest {

    private static final int PER_CORRECT = 20;
    private static final int PERFECT_BONUS = 60;
    private static final int MAX_GAP = 30;
    private static final Instant NOW = Instant.parse("2026-01-01T09:00:00Z");

    @Mock
    private UserRepository userRepository;

    private GameService gameService;
    private User user;

    @BeforeEach
    void setUp() {
        gameService = new GameService(userRepository, properties(), Clock.fixed(NOW, ZoneOffset.UTC));
        user = Fixtures.user(7L, "student@example.com", "Student");
        // Lenient: the tests about what a quiz pays never look the account up.
        lenient().when(userRepository.findById(7L)).thenReturn(Optional.of(user));
    }

    @Test
    void reportsTheBalanceAndTheRatesThatEarnIt() {
        user.awardPlaySeconds(100);
        GameStatusView status = gameService.status(7L);
        assertThat(status.secondsRemaining()).isEqualTo(100);
        assertThat(status.secondsPerCorrectAnswer()).isEqualTo(PER_CORRECT);
        assertThat(status.perfectBonusSeconds()).isEqualTo(PERFECT_BONUS);
    }

    @Test
    void paysPerCorrectAnswer() {
        assertThat(gameService.earnedFor(3, 5)).isEqualTo(3 * PER_CORRECT);
    }

    @Test
    void paysABonusOnlyForACleanSweep() {
        assertThat(gameService.earnedFor(5, 5)).isEqualTo(5 * PER_CORRECT + PERFECT_BONUS);
        assertThat(gameService.earnedFor(4, 5)).isEqualTo(4 * PER_CORRECT);
    }

    @Test
    void paysNothingForAQuizThatWentBadly() {
        assertThat(gameService.earnedFor(0, 5)).isZero();
    }

    @Test
    void aFirstHeartbeatStartsTheClockRatherThanBilling() {
        user.awardPlaySeconds(100);
        // The balance covers the whole time since the account was created; none of it is spent.
        GameStatusView status = gameService.heartbeat(7L);
        assertThat(status.secondsRemaining()).isEqualTo(100);
        assertThat(user.getPlayHeartbeatAt()).isEqualTo(NOW);
    }

    @Test
    void aLaterHeartbeatBillsTheTimeInBetween() {
        user.awardPlaySeconds(100);
        user.setPlayHeartbeatAt(NOW.minusSeconds(10));
        GameStatusView status = gameService.heartbeat(7L);
        assertThat(status.secondsRemaining()).isEqualTo(90);
        assertThat(user.getPlayHeartbeatAt()).isEqualTo(NOW);
    }

    @Test
    void capsWhatOneGapCanCost() {
        user.awardPlaySeconds(100);
        // Away for an hour: the gap is capped, so the balance survives being abandoned.
        user.setPlayHeartbeatAt(NOW.minus(Duration.ofHours(1)));
        assertThat(gameService.heartbeat(7L).secondsRemaining()).isEqualTo(100 - MAX_GAP);
    }

    @Test
    void neverSpendsMoreThanIsThere() {
        user.awardPlaySeconds(5);
        user.setPlayHeartbeatAt(NOW.minusSeconds(60));
        assertThat(gameService.heartbeat(7L).secondsRemaining()).isZero();
    }

    @Test
    void stopsTheClockAtZeroSoTheBreakIsNotBilled() {
        user.awardPlaySeconds(5);
        user.setPlayHeartbeatAt(NOW.minusSeconds(60));
        gameService.heartbeat(7L);
        assertThat(user.getPlayHeartbeatAt()).isNull();

        // A quiz tops the balance up; the next heartbeat must not charge the gap since the last one.
        user.awardPlaySeconds(100);
        assertThat(gameService.heartbeat(7L).secondsRemaining()).isEqualTo(100);
    }

    @Test
    void toleratesAClockThatWentBackwards() {
        user.awardPlaySeconds(100);
        user.setPlayHeartbeatAt(NOW.plusSeconds(30));
        assertThat(gameService.heartbeat(7L).secondsRemaining()).isEqualTo(100);
    }

    private static RealMathsProperties properties() {
        return new RealMathsProperties(
                new RealMathsProperties.Jwt("secret", "realmaths", Duration.ofHours(12)),
                new RealMathsProperties.Cors(List.of("http://localhost:5173")),
                new RealMathsProperties.Quiz(5, 20, 10),
                new RealMathsProperties.Game(PER_CORRECT, PERFECT_BONUS, MAX_GAP),
                new RealMathsProperties.Google("", List.of()));
    }
}
