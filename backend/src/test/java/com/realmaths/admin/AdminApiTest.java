package com.realmaths.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.realmaths.auth.JwtService;
import com.realmaths.user.Role;
import com.realmaths.user.User;
import com.realmaths.user.UserRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * The admin API against a real context and a real database.
 *
 * <p>Worth having as an integration test rather than mocked unit tests for two reasons: the
 * security gate is configuration, so only a real filter chain proves it, and replacing a
 * question's options in place is the kind of thing that only fails against a real unique index.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminApiTest {

    private static final Path DB_DIR = createTempDirectory();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add(
                "spring.datasource.url",
                () -> "jdbc:sqlite:%s?foreign_keys=on&journal_mode=WAL&busy_timeout=5000"
                        .formatted(DB_DIR.resolve("admin-api-test.db")));
        registry.add("realmaths.google.client-id", () -> "test-client-id.apps.googleusercontent.com");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtService jwtService;

    // ------------------------------------------------------------- the gate ---

    /**
     * The whole point of putting the rule on the path prefix: these are ordinary authenticated
     * endpoints to anybody without the role.
     */
    @Test
    void aStudentIsRefusedEveryAdminRoute() throws Exception {
        String student = tokenFor("student@example.com", Role.STUDENT);

        for (String route : new String[] {"/api/admin/questions", "/api/admin/questions/1", "/api/admin/topics"}) {
            mockMvc.perform(get(route).header("Authorization", "Bearer " + student))
                    .andExpect(status().isForbidden());
        }

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question("2 + 2")))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/admin/questions/1/publish").header("Authorization", "Bearer " + student))
                .andExpect(status().isForbidden());
    }

    @Test
    void anAnonymousCallerIsRefusedBeforeAuthorisationIsEvenConsidered() throws Exception {
        mockMvc.perform(get("/api/admin/questions")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/admin/questions/1/publish")).andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------- authoring flow ---

    @Test
    void aQuestionCanBeDraftedEditedPublishedAndRetired() throws Exception {
        String admin = adminToken();
        // Unique per run, so the search assertion below cannot be satisfied by another test's
        // question in the same database.
        String marker = "marker" + System.nanoTime();

        // 1. Create as a draft. Nothing is live yet.
        long id = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question(marker + " what is 2 plus 2", "4", "5")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.origin").value("AUTHORED"))
                .andReturn());

        mockMvc.perform(get("/api/admin/questions?status=DRAFT&q=" + marker)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));

        // 2. Edit it, replacing the option set AND moving which option is correct. This is the
        //    case that would fail against the partial unique index if the deletes were not
        //    flushed before the inserts, and it proves the correctness flags are replaced
        //    rather than merged with what was there before.
        mockMvc.perform(put("/api/admin/questions/" + id)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question(marker + " what is 3 plus 4", 2, "6", "7", "8")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options.length()").value(3))
                // Labels are derived from position on the server, never taken from the client.
                .andExpect(jsonPath("$.options[0].label").value("A"))
                .andExpect(jsonPath("$.options[2].label").value("C"))
                .andExpect(jsonPath("$.options[0].correct").value(false))
                .andExpect(jsonPath("$.options[2].correct").value(true));

        // 3. Publish.
        mockMvc.perform(post("/api/admin/questions/" + id + "/publish").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        // 4. Retire. Never deleted: quiz_answers cascades on delete.
        mockMvc.perform(post("/api/admin/questions/" + id + "/retire").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETIRED"));

        // Still there, and still reachable in the editor.
        mockMvc.perform(get("/api/admin/questions/" + id).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETIRED"));
    }

    /** The design point: a draft may be half-written, and simply cannot be published. */
    @Test
    void anEmptyDraftSavesButRefusesToPublish() throws Exception {
        String admin = adminToken();

        long id = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicId\":1,\"prompt\":null,\"explanation\":null,\"difficulty\":1,\"options\":[]}"))
                .andExpect(status().isCreated())
                .andReturn());

        mockMvc.perform(post("/api/admin/questions/" + id + "/publish").header("Authorization", "Bearer " + admin))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.prompt").exists())
                .andExpect(jsonPath("$.fieldErrors.options").exists())
                .andExpect(jsonPath("$.fieldErrors['options.correct']").exists());
    }

    @Test
    void aQuestionCannotBeSavedWithMoreThanSixOptions() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question("Too many", "1", "2", "3", "4", "5", "6", "7")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.options").exists());
    }

    @Test
    void difficultyOutsideOneToFiveIsRejected() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topicId":1,"prompt":"x","explanation":null,"difficulty":9,
                                 "options":[{"text":"a","correct":true},{"text":"b","correct":false}]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.difficulty").exists());
    }

    @Test
    void anUnknownTopicIsReportedAgainstTheTopicField() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topicId":999999,"prompt":"x","explanation":null,"difficulty":1,
                                 "options":[{"text":"a","correct":true},{"text":"b","correct":false}]}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.topicId").exists());
    }

    /**
     * A mistyped filter is a client mistake. Without an explicit handler the catch-all in
     * GlobalExceptionHandler turns it into a 500 and a stack trace.
     */
    @Test
    void anUnrecognisedFilterValueIsAClientErrorNotAServerError() throws Exception {
        String admin = adminToken();

        mockMvc.perform(get("/api/admin/questions?status=NONSENSE").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/questions?origin=GUESSED").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/questions?difficulty=hard").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------------- topics ---

    @Test
    void topicsCanBeListedCreatedAndEdited() throws Exception {
        String admin = adminToken();

        long id = idOf(mockMvc.perform(post("/api/admin/topics")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"ratio","name":"Ratio & Proportion","description":"Sharing in a ratio.","sortOrder":6}
                                """))
                .andExpect(status().isCreated())
                .andReturn());

        mockMvc.perform(put("/api/admin/topics/" + id)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"ratio","name":"Ratio and Proportion","description":null,"sortOrder":6}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ratio and Proportion"));

        mockMvc.perform(get("/api/admin/topics").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='ratio')].name")
                        .value("Ratio and Proportion"));
    }

    @Test
    void aDuplicateTopicSlugIsReportedAsAConflict() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/topics")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"number","name":"Clash","description":null,"sortOrder":9}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void aMalformedSlugIsRejectedWithAFieldError() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/topics")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"Not A Slug!","name":"x","description":null,"sortOrder":9}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.slug").exists());
    }

    // ----------------------------------------------------------------- helpers ---

    private String adminToken() {
        return tokenFor("teacher-" + System.nanoTime() + "@example.com", Role.ADMIN);
    }

    private String tokenFor(String email, Role role) {
        User user = new User(email, "Test User");
        user.setRole(role);
        return jwtService.issueFor(users.save(user)).token();
    }

    private static String question(String prompt, String... options) {
        return question(prompt, 0, options);
    }

    /** @param correctIndex which option is the right answer, zero-based */
    private static String question(String prompt, int correctIndex, String... options) {
        StringBuilder json = new StringBuilder("""
                {"topicId":1,"prompt":"%s","explanation":"Because.","difficulty":2,"options":[
                """.formatted(prompt));
        for (int index = 0; index < options.length; index++) {
            if (index > 0) {
                json.append(',');
            }
            json.append("{\"text\":\"%s\",\"correct\":%s}".formatted(options[index], index == correctIndex));
        }
        return json.append("]}").toString();
    }

    private long idOf(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.has("id")).as("response should carry an id").isTrue();
        return body.get("id").asLong();
    }

    private static Path createTempDirectory() {
        try {
            return Files.createTempDirectory("realmaths-admin-test");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
