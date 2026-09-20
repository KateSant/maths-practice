package com.realmaths.quiz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.util.ArrayList;
import java.util.List;
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
 * The year group dropdown, end to end: the year a student asks for decides which questions come
 * back, and asking for a year above their own is allowed.
 *
 * <p>An integration test rather than a mocked one because the whole feature is a filter in a
 * native query and a column default. A mocked repository would only prove the service passes a
 * number along, which is the part that was never in doubt.
 */
@SpringBootTest
@AutoConfigureMockMvc
class QuizYearGroupApiTest {

    private static final Path DB_DIR = createTempDirectory();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add(
                "spring.datasource.url",
                () -> "jdbc:sqlite:%s?foreign_keys=on&journal_mode=WAL&busy_timeout=5000"
                        .formatted(DB_DIR.resolve("quiz-year-group-test.db")));
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

    @Test
    void aYearGroupSelectsWhichQuestionsAreDealt() throws Exception {
        String admin = adminToken();
        String student = studentToken();

        String year8 = "year8-" + System.nanoTime();
        String year9 = "year9-" + System.nanoTime();
        publishQuestion(admin, 8, year8);
        publishQuestion(admin, 9, year9);

        // Year 8 must not be handed the 32 seeded Year 7 questions, nor the Year 9 one.
        JsonNode session = startSession(student, 8);
        assertThat(session.get("yearGroup").asInt()).isEqualTo(8);
        assertThat(promptsOf(session))
                .as("only questions filed in Year 8")
                .containsExactly(year8 + " what is 2 plus 2");

        // The year group is recorded on the session, not just echoed back at the start. It is what
        // lets the results page offer "try again" at the year the student actually worked at.
        mockMvc.perform(get("/api/quiz/sessions/" + session.get("sessionId").asLong())
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.yearGroup").value(8));

        // The same request at Year 9 gets the other question, so the dropdown really is the filter.
        assertThat(promptsOf(startSession(student, 9))).containsExactly(year9 + " what is 2 plus 2");

        // Year 10 has nothing published, and says which year came up empty rather than dealing
        // an empty set or blaming the topic.
        mockMvc.perform(post("/api/quiz/sessions")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicSlug\":\"number\",\"count\":5,\"yearGroup\":10}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("There are no Year 10 questions for that topic yet."));
    }

    /** No year group means every year, which keeps the endpoint usable without one. */
    @Test
    void omittingTheYearGroupDrawsFromEveryYear() throws Exception {
        String admin = adminToken();
        String student = studentToken();

        String year12 = "year12-" + System.nanoTime();
        publishQuestion(admin, 12, year12);

        MvcResult result = mockMvc.perform(post("/api/quiz/sessions")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicSlug\":\"number\",\"count\":20}"))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode session = objectMapper.readTree(result.getResponse().getContentAsString());
        // Absent rather than null: Jackson is configured to omit nulls.
        assertThat(session.has("yearGroup")).as("no year group was asked for").isFalse();

        List<String> prompts = promptsOf(session);
        assertThat(prompts).contains(year12 + " what is 2 plus 2");
        assertThat(prompts)
                .as("and the Year 7 starter bank, because nothing was filtered out")
                .hasSizeGreaterThan(1);
    }

    @Test
    void aYearGroupOutsideSevenToThirteenIsRejected() throws Exception {
        String student = studentToken();

        mockMvc.perform(post("/api/quiz/sessions")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicSlug\":\"number\",\"count\":5,\"yearGroup\":6}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.yearGroup").exists());

        mockMvc.perform(post("/api/quiz/sessions")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicSlug\":\"number\",\"count\":5,\"yearGroup\":14}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.yearGroup").exists());
    }

    // ----------------------------------------------------------------- helpers ---

    /** Creates a question in a year group and publishes it, so the dealing queries can see it. */
    private void publishQuestion(String admin, int yearGroup, String marker) throws Exception {
        long id = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topicId":1,"prompt":"%s what is 2 plus 2","explanation":"Because.",
                                 "difficulty":1,"yearGroup":%d,
                                 "options":[{"text":"4","correct":true},{"text":"5","correct":false}]}
                                """.formatted(marker, yearGroup)))
                .andExpect(status().isCreated())
                .andReturn());

        mockMvc.perform(post("/api/admin/questions/" + id + "/publish")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
    }

    private JsonNode startSession(String student, int yearGroup) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/quiz/sessions")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicSlug\":\"number\",\"count\":5,\"yearGroup\":%d}".formatted(yearGroup)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private static List<String> promptsOf(JsonNode session) {
        List<String> prompts = new ArrayList<>();
        session.get("questions").forEach(question -> prompts.add(question.get("prompt").asText()));
        return prompts;
    }

    private String adminToken() {
        return tokenFor("year-admin-" + System.nanoTime() + "@example.com", Role.ADMIN);
    }

    private String studentToken() {
        return tokenFor("year-student-" + System.nanoTime() + "@example.com", Role.STUDENT);
    }

    private String tokenFor(String email, Role role) {
        User user = new User(email, "Test User");
        user.setRole(role);
        return jwtService.issueFor(users.save(user)).token();
    }

    private long idOf(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private static Path createTempDirectory() {
        try {
            return Files.createTempDirectory("realmaths-year-group-test");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
