package com.realmaths.profile;

import com.realmaths.auth.UserPrincipal;
import com.realmaths.profile.dto.ProfileView;
import com.realmaths.profile.dto.UpdateProfileRequest;
import com.realmaths.quiz.QuizService;
import com.realmaths.quiz.dto.QuizHistoryItem;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class ProfileController {

    private final ProfileService profileService;
    private final QuizService quizService;

    public ProfileController(ProfileService profileService, QuizService quizService) {
        this.profileService = profileService;
        this.quizService = quizService;
    }

    @GetMapping
    public ProfileView me(@AuthenticationPrincipal UserPrincipal principal) {
        return profileService.getProfile(principal.id());
    }

    @PatchMapping
    public ProfileView updateMe(
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody UpdateProfileRequest request) {
        return profileService.updateDisplayName(principal.id(), request.displayName());
    }

    @GetMapping("/history")
    public List<QuizHistoryItem> history(@AuthenticationPrincipal UserPrincipal principal) {
        return quizService.history(principal.id());
    }
}
