package com.realmaths.game.dto;

import com.realmaths.config.RealMathsProperties;
import com.realmaths.user.User;

/**
 * Where a student's play time stands, plus the rates that earned it - the client shows the rates
 * next to the countdown, so "do more maths to play more" is visible rather than folklore.
 */
public record GameStatusView(
        int secondsRemaining, int secondsPerCorrectAnswer, int perfectBonusSeconds, int maxSessionSeconds) {

    public static GameStatusView from(User user, RealMathsProperties properties) {
        return new GameStatusView(
                user.getPlaySeconds(),
                properties.game().secondsPerCorrectAnswer(),
                properties.game().perfectBonusSeconds(),
                properties.game().maxHeartbeatGapSeconds());
    }
}
