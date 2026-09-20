package com.realmaths.game;

import com.realmaths.auth.UserPrincipal;
import com.realmaths.game.dto.GameStatusView;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/game")
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    /** The balance, without spending any of it. */
    @GetMapping
    public GameStatusView status(@AuthenticationPrincipal UserPrincipal principal) {
        return gameService.status(principal.id());
    }

    /** "Still playing": bills the time since the previous call and returns what is left. */
    @PostMapping("/heartbeat")
    public GameStatusView heartbeat(@AuthenticationPrincipal UserPrincipal principal) {
        return gameService.heartbeat(principal.id());
    }
}
