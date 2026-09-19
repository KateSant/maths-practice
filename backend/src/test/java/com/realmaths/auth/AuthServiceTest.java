package com.realmaths.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.realmaths.auth.dto.AuthResponse;
import com.realmaths.common.ApiException;
import com.realmaths.support.Fixtures;
import com.realmaths.user.User;
import com.realmaths.user.UserIdentity;
import com.realmaths.user.UserIdentityRepository;
import com.realmaths.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/**
 * Orchestration only: resolving a verified identity to a user row. What counts as a
 * verified identity is {@link GoogleIdTokenVerifierTest}'s problem.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-01T09:00:00Z");
    private static final String ID_TOKEN = "google-id-token";

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserIdentityRepository identityRepository;

    @Mock
    private GoogleIdTokenVerifier googleVerifier;

    @Mock
    private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository, identityRepository, googleVerifier, jwtService, Clock.fixed(NOW, ZoneOffset.UTC));
        // Lenient: the refusal paths throw before a token is ever issued, so this stub is
        // legitimately unused in those tests.
        lenient().when(jwtService.issueFor(any()))
                .thenReturn(new JwtService.IssuedToken("our.jwt", NOW.plusSeconds(3600)));
    }

    private void givenGoogleReturns(GoogleIdentity identity) {
        when(googleVerifier.verify(ID_TOKEN)).thenReturn(identity);
    }

    private static GoogleIdentity gmailIdentity() {
        return new GoogleIdentity("sub-1", "learner@gmail.com", "Ada Lovelace", null, true);
    }

    // -------------------------------------------------------------- first sight ---

    @Test
    void createsAUserAndAnIdentityOnFirstSignIn() {
        givenGoogleReturns(gmailIdentity());
        when(identityRepository.findByProviderAndSubject("google", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("learner@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        AuthResponse response = authService.signInWithGoogle(ID_TOKEN);

        ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUser.capture());
        assertThat(savedUser.getValue().getEmail()).isEqualTo("learner@gmail.com");
        assertThat(savedUser.getValue().getDisplayName()).isEqualTo("Ada Lovelace");

        ArgumentCaptor<UserIdentity> savedIdentity = ArgumentCaptor.forClass(UserIdentity.class);
        verify(identityRepository).save(savedIdentity.capture());
        assertThat(savedIdentity.getValue().getProvider()).isEqualTo("google");
        assertThat(savedIdentity.getValue().getSubject()).isEqualTo("sub-1");
        assertThat(savedIdentity.getValue().getLastLoginAt()).isEqualTo(NOW);

        assertThat(response.token()).isEqualTo("our.jwt");
        assertThat(response.user().email()).isEqualTo("learner@gmail.com");
    }

    /** The whole point of keying on subject: signing in twice is not two accounts. */
    @Test
    void reusesTheExistingUserForTheSameGoogleSubject() {
        User existingUser = Fixtures.user(7L, "learner@gmail.com", "Ada");
        UserIdentity identity = new UserIdentity(existingUser, "google", "sub-1", "learner@gmail.com", NOW.minusSeconds(60));
        when(identityRepository.findByProviderAndSubject("google", "sub-1")).thenReturn(Optional.of(identity));
        givenGoogleReturns(gmailIdentity());

        AuthResponse response = authService.signInWithGoogle(ID_TOKEN);

        assertThat(response.user().id()).isEqualTo(7L);
        verify(userRepository, never()).save(any());
        verify(identityRepository, never()).save(any());
    }

    @Test
    void refreshesTheStoredProviderEmailOnEverySignIn() {
        User existingUser = Fixtures.user(7L, "learner@gmail.com", "Ada");
        UserIdentity identity =
                new UserIdentity(existingUser, "google", "sub-1", "old-address@gmail.com", NOW.minusSeconds(60));
        when(identityRepository.findByProviderAndSubject("google", "sub-1")).thenReturn(Optional.of(identity));
        givenGoogleReturns(gmailIdentity());

        authService.signInWithGoogle(ID_TOKEN);

        assertThat(identity.getEmailAtProvider()).isEqualTo("learner@gmail.com");
        assertThat(identity.getLastLoginAt()).isEqualTo(NOW);
    }

    // ------------------------------------------------- account linking by email ---

    @Test
    void linksToAnExistingAccountWhenGoogleIsAuthoritativeForTheEmail() {
        User existing = Fixtures.user(9L, "learner@gmail.com", "Ada");
        when(identityRepository.findByProviderAndSubject("google", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("learner@gmail.com")).thenReturn(Optional.of(existing));
        givenGoogleReturns(gmailIdentity());

        AuthResponse response = authService.signInWithGoogle(ID_TOKEN);

        assertThat(response.user().id()).isEqualTo(9L);
        // Linked, not duplicated.
        verify(userRepository, never()).save(any());
        verify(identityRepository).save(any(UserIdentity.class));
    }

    /**
     * Google can be relaying an address it did not issue and does not vouch for. If we
     * attached the identity anyway, whoever controls that Google account would inherit
     * the existing learner's account.
     */
    @Test
    void refusesToLinkToAnExistingAccountWhenGoogleIsNotAuthoritativeForTheEmail() {
        User existing = Fixtures.user(9L, "someone@school.example", "Someone");
        when(identityRepository.findByProviderAndSubject("google", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("someone@school.example")).thenReturn(Optional.of(existing));
        givenGoogleReturns(new GoogleIdentity("sub-1", "someone@school.example", "Someone", null, false));

        assertThatThrownBy(() -> authService.signInWithGoogle(ID_TOKEN))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);

        verify(identityRepository, never()).save(any());
    }

    // ------------------------------------------------------------------- guests ---

    @Test
    void createsAGuestWithNoIdentitySoItCannotBeSignedIntoAgain() {
        when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        AuthResponse response = authService.continueAsGuest();

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getEmail()).matches("guest_[0-9a-f]{10}@realmaths\\.local");
        assertThat(saved.getValue().getDisplayName()).startsWith("Guest ");
        assertThat(saved.getValue().getRole()).isEqualTo(com.realmaths.user.Role.STUDENT);

        // No identity row, so there is no way back into this account.
        verify(identityRepository, never()).save(any());
        assertThat(response.token()).isEqualTo("our.jwt");
    }

    /** Generated server-side, so two guests never collide and a client cannot choose one. */
    @Test
    void givesEachGuestItsOwnAccount() {
        when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        String first = authService.continueAsGuest().user().email();
        String second = authService.continueAsGuest().user().email();

        assertThat(first).isNotEqualTo(second);
    }
}
