package com.realmaths.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.realmaths.auth.dto.AuthResponse;
import com.realmaths.auth.dto.LoginRequest;
import com.realmaths.auth.dto.RegisterRequest;
import com.realmaths.common.ApiException;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        // The constructor hashes a throwaway value for the timing-equalisation path.
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$dummyhash");
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    private void stubToken() {
        when(jwtService.issueFor(any())).thenReturn(new JwtService.IssuedToken("signed.jwt.token", Instant.now()));
    }

    @Test
    void registerHashesThePasswordAndNormalisesTheEmail() {
        when(userRepository.existsByEmailIgnoreCase("learner@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("$2a$hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        stubToken();

        AuthResponse response = authService.register(
                new RegisterRequest("  Learner@Example.COM  ", "password123", "  Ada  "));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());

        assertThat(saved.getValue().getEmail()).isEqualTo("learner@example.com");
        assertThat(saved.getValue().getDisplayName()).isEqualTo("Ada");
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("$2a$hashed");
        assertThat(saved.getValue().getPasswordHash()).isNotEqualTo("password123");
        assertThat(response.token()).isEqualTo("signed.jwt.token");
        assertThat(response.user().email()).isEqualTo("learner@example.com");
    }

    @Test
    void registerRejectsADuplicateEmail() {
        when(userRepository.existsByEmailIgnoreCase("taken@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(new RegisterRequest("taken@example.com", "password123", "Ada")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists")
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);

        verify(userRepository, never()).save(any());
    }

    @Test
    void loginSucceedsWithTheRightPassword() {
        User existing = new User("learner@example.com", "$2a$stored", "Ada");
        when(userRepository.findByEmailIgnoreCase("learner@example.com")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("password123", "$2a$stored")).thenReturn(true);
        stubToken();

        AuthResponse response = authService.login(new LoginRequest("LEARNER@example.com", "password123"));

        assertThat(response.token()).isEqualTo("signed.jwt.token");
        assertThat(response.user().displayName()).isEqualTo("Ada");
    }

    @Test
    void loginRejectsTheWrongPassword() {
        when(userRepository.findByEmailIgnoreCase("learner@example.com"))
                .thenReturn(Optional.of(new User("learner@example.com", "$2a$stored", "Ada")));
        when(passwordEncoder.matches("wrong", "$2a$stored")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("learner@example.com", "wrong")))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Email or password is incorrect.");
    }

    @Test
    void loginForAnUnknownEmailStillHashesAValueToAvoidLeakingWhichEmailsExist() {
        when(userRepository.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.matches(eq("password123"), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost@example.com", "password123")))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Email or password is incorrect.");

        // Same message as a wrong password, and a real hash comparison still happened.
        verify(passwordEncoder).matches("password123", "$2a$dummyhash");
    }
}
