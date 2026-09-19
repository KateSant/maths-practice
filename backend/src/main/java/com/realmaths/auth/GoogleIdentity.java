package com.realmaths.auth;

/**
 * The claims we care about from a verified Google ID token.
 *
 * <p>{@code emailAuthoritative} is Google's own notion, and it is narrower than
 * "the email is verified": Google is only authoritative for an address when it is
 * a {@code @gmail.com} address, or when the account belongs to a Google Workspace
 * domain. A Google account can also carry a third-party address (say, a school
 * address that Google did not issue), and Google explicitly does not vouch for
 * ownership of those — the address may have been reassigned since.
 *
 * <p>That distinction is the whole reason identity is keyed on {@code subject} and
 * not on email, and it is what makes it safe to attach a Google identity to an
 * existing account by matching on the address.
 */
public record GoogleIdentity(
        String subject,
        String email,
        String displayName,
        String hostedDomain,
        boolean emailAuthoritative) {}
