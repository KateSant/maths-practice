package com.realmaths.auth;

import com.realmaths.auth.dto.AuthResponse;
import com.realmaths.auth.dto.UserResponse;
import com.realmaths.common.ApiException;
import com.realmaths.user.User;
import com.realmaths.user.UserIdentity;
import com.realmaths.user.UserIdentityRepository;
import com.realmaths.user.UserRepository;
import com.realmaths.user.WeeklyStreak;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns a verified external identity (or a guest) into a local {@link User} and one
 * of our own access tokens.
 *
 * <p>The provider is only ever a way of obtaining the user row. Points, streaks,
 * progress and role all hang off {@code users}, and the token we issue is our own, so
 * nothing downstream of this class knows or cares how somebody signed in.
 */
@Service
public class AuthService {

    /**
     * Guests have no email, but {@code users.email} is not-null and unique, so they get
     * a synthetic address in a domain we control. Making the column nullable would mean
     * rebuilding the table — SQLite cannot drop a NOT NULL constraint in place, and
     * {@code quiz_sessions} holds a foreign key to it — which is not worth it for a
     * cosmetic gain. Synthetic addresses also guarantee a guest can never collide with
     * a real Google address.
     */
    private static final String GUEST_EMAIL_DOMAIN = "realmaths.local";

    private final UserRepository userRepository;
    private final UserIdentityRepository identityRepository;
    private final GoogleIdTokenVerifier googleVerifier;
    private final JwtService jwtService;
    private final Clock clock;

    public AuthService(
            UserRepository userRepository,
            UserIdentityRepository identityRepository,
            GoogleIdTokenVerifier googleVerifier,
            JwtService jwtService,
            Clock clock) {
        this.userRepository = userRepository;
        this.identityRepository = identityRepository;
        this.googleVerifier = googleVerifier;
        this.jwtService = jwtService;
        this.clock = clock;
    }

    /**
     * Sign in with Google, creating the local account on first sight.
     *
     * <p>Idempotent by construction: the {@code (provider, subject)} unique constraint
     * means the same Google account always resolves to the same user row.
     */
    @Transactional
    public AuthResponse signInWithGoogle(String idToken) {
        GoogleIdentity identity = googleVerifier.verify(idToken);
        return respondWith(userFor(identity));
    }

    private User userFor(GoogleIdentity identity) {
        UserIdentity known = identityRepository
                .findByProviderAndSubject(UserIdentity.PROVIDER_GOOGLE, identity.subject())
                .orElse(null);

        if (known != null) {
            // The provider owns these details, so refresh them rather than trusting the
            // copies we stored last time. This is not an error path.
            known.recordSignIn(identity.email(), clock.instant());
            return known.getUser();
        }
        return linkOrCreate(identity);
    }

    private User linkOrCreate(GoogleIdentity identity) {
        User existing = userRepository.findByEmailIgnoreCase(identity.email()).orElse(null);

        if (existing != null && !identity.emailAuthoritative()) {
            // Google is relaying a third-party address here and cannot vouch that this
            // person owns it, so attaching the identity would hand them the account.
            // Refusing is the safe branch; the honest fix is a separate linking flow.
            throw ApiException.conflict("An account with that email address already exists.");
        }

        User user = existing != null
                ? existing
                : userRepository.save(new User(identity.email(), identity.displayName()));

        identityRepository.save(new UserIdentity(
                user, UserIdentity.PROVIDER_GOOGLE, identity.subject(), identity.email(), clock.instant()));
        return user;
    }

    /**
     * A throwaway account so somebody can try a quiz without signing in. No identity
     * row, so it can never be reached again once the token expires — and because admin
     * is granted by email, a guest can never become one.
     */
    @Transactional
    public AuthResponse continueAsGuest() {
        // Generated here rather than in the browser: a client-chosen identity is not
        // worth the trust.
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        User guest = userRepository.save(new User(
                "guest_%s@%s".formatted(suffix, GUEST_EMAIL_DOMAIN),
                "Guest " + suffix.substring(0, 4).toUpperCase(Locale.ROOT)));
        return respondWith(guest);
    }

    private AuthResponse respondWith(User user) {
        JwtService.IssuedToken issued = jwtService.issueFor(user);
        return new AuthResponse(issued.token(), issued.expiresAt(), UserResponse.from(user, WeeklyStreak.today(clock)));
    }
}
