package com.realmaths.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {

    /**
     * The one lookup that decides who a signed-in person is. Keyed on the provider's
     * immutable subject, never on email.
     */
    Optional<UserIdentity> findByProviderAndSubject(String provider, String subject);
}
