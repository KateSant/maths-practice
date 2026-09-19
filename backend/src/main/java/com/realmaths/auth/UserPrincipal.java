package com.realmaths.auth;

import com.realmaths.user.Role;
import com.realmaths.user.User;

/**
 * The authenticated caller, resolved from the JWT on each request.
 *
 * Deliberately a small immutable snapshot rather than the {@link User} entity:
 * controllers and services that need to *change* the user re-load it inside their
 * own transaction instead of mutating a detached entity.
 */
public record UserPrincipal(Long id, String email, String displayName, Role role) {

    public static UserPrincipal from(User user) {
        return new UserPrincipal(user.getId(), user.getEmail(), user.getDisplayName(), user.getRole());
    }
}
