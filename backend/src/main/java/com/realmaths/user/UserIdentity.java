package com.realmaths.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A link between a {@link User} and an external identity provider: today only
 * Google, but the shape is deliberately provider-agnostic.
 *
 * <p>This exists so that identity is keyed on {@code (provider, subject)} rather
 * than on email. Google's {@code sub} claim is stable for the life of the account
 * and is never reused; an email address is mutable and can be reassigned to a
 * different person, so matching on it is how accounts get taken over.
 */
@Entity
@Table(name = "user_identities")
public class UserIdentity {

    /** The only provider so far. Kept as a constant so it is spelled once. */
    public static final String PROVIDER_GOOGLE = "google";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // See User.id for why this override is needed on SQLite.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 30)
    private String provider;

    /** The provider's own immutable identifier for the account. */
    @Column(nullable = false, length = 255)
    private String subject;

    /**
     * The address the provider reports, refreshed on every sign-in. Informational
     * only — never used to decide who someone is.
     */
    @Column(name = "email_at_provider", length = 255)
    private String emailAtProvider;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected UserIdentity() {
        // for JPA
    }

    public UserIdentity(User user, String provider, String subject, String emailAtProvider, Instant at) {
        this.user = user;
        this.provider = provider;
        this.subject = subject;
        this.emailAtProvider = emailAtProvider;
        this.createdAt = at;
        this.lastLoginAt = at;
    }

    /**
     * Refreshes the details the provider owns. The provider may have changed the
     * account's display address since we last saw it, so this is not an error path.
     */
    public void recordSignIn(String emailAtProvider, Instant at) {
        this.emailAtProvider = emailAtProvider;
        this.lastLoginAt = at;
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getProvider() {
        return provider;
    }

    public String getSubject() {
        return subject;
    }

    public String getEmailAtProvider() {
        return emailAtProvider;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }
}
