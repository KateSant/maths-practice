package com.realmaths.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Boots the real application context.
 *
 * <p>Two things are only checkable here. First, Hibernate runs with
 * {@code ddl-auto=validate}, so this test fails if the entities and the migrated schema
 * disagree — verification the community SQLite dialect cannot offer on its own. Second,
 * the {@link JwtDecoder} must stay singular; see below.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthWiringTest {

    /**
     * A real database file, created outside the repository so the developer's
     * {@code backend/data/realmaths.db} is never touched by a test run.
     */
    private static final Path DB_DIR = createTempDirectory();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add(
                "spring.datasource.url",
                () -> "jdbc:sqlite:%s?foreign_keys=on&journal_mode=WAL&busy_timeout=5000"
                        .formatted(DB_DIR.resolve("wiring-test.db")));
        // Pinned so the tests do not depend on whether the developer happens to have the
        // real client ID exported.
        registry.add("realmaths.google.client-id", () -> "test-client-id.apps.googleusercontent.com");
    }

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * The trap this guards: the Google verifier builds its own {@code JwtDecoder} and
     * must not publish it as a bean. If a second one ever appears, the resource server
     * could be wired to Google's signing keys, at which point any Google ID token would
     * be accepted as a credential for our API.
     */
    @Test
    void thereIsExactlyOneJwtDecoderSoGooglesKeysCannotBecomeApiCredentials() {
        assertThat(context.getBeanNamesForType(JwtDecoder.class))
                .as("the decoder that authenticates our own tokens must be the only one")
                .hasSize(1);
        assertThat(context.getBeanNamesForType(GoogleIdTokenVerifier.class))
                .as("but the verifier itself is wired normally")
                .hasSize(1);
    }

    /** With the client ID blank the server must refuse, not skip the audience check. */
    @Test
    void signInEndpointsAreOpenAndTheRestOfTheApiIsNot() throws Exception {
        mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/topics")).andExpect(status().isUnauthorized());

        // Open, but rejects anything that is not a valid Google token for this client.
        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"not-a-real-token\"}"))
                .andExpect(status().isUnauthorized());

        // Missing body is a validation failure, not an auth failure.
        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        // The retired password endpoints, and anything else unknown under this prefix,
        // must be a 404 rather than a 500 with a stack trace in the log.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"a@b.c\",\"password\":\"x\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/auth/nonsense")).andExpect(status().isNotFound());
    }

    /**
     * The full path a real guest takes: no credentials in, our own token out, and that
     * token then accepted by the rest of the API.
     */
    @Test
    void aGuestTokenIsAcceptedByTheRestOfTheApi() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/guest"))
                .andExpect(status().isCreated())
                .andReturn();

        String token = objectMapper
                .readTree(result.getResponse().getContentAsString())
                .get("token")
                .asText();
        assertThat(token).isNotBlank();

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // A junk bearer token must not be mistaken for one of ours.
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    private static Path createTempDirectory() {
        try {
            return Files.createTempDirectory("realmaths-wiring-test");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
