package com.realmaths.quiz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * The student's half of the quiz API, against a real context and a real database.
 *
 * <p>This exists because the interesting failure here is one that mocked unit tests structurally
 * cannot see. {@code QuizServiceTest} builds its questions in memory, so every collection it grades
 * has exactly the members it put there. The review query, by contrast, fetches the question's
 * options and the student's selection in a single round trip, and that join multiplies the rows:
 * fetching two collections at once produces a cartesian product, and a bag is populated from every
 * row. The symptom is a correct answer key rendered twice - which no amount of mocking reproduces,
 * because there is no join to go wrong.
 */
@SpringBootTest
@AutoConfigureMockMvc
class QuizApiTest {

    private static final Path DB_DIR = createTempDirectory();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add(
                "spring.datasource.url",
                () -> "jdbc:sqlite:%s?foreign_keys=on&journal_mode=WAL&busy_timeout=5000"
                        .formatted(DB_DIR.resolve("quiz-api-test.db")));
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

    /** Never sent to a student: the whole answer key stays on the server. */
    @Test
    void aTickAllQuestionIsServedWithoutItsAnswerKey() throws Exception {
        String admin = adminToken();
        long questionId = publishedTickAllQuestion(admin);

        String student = studentToken();
        JsonNode session = startSession(student, 20);

        JsonNode question = findQuestion(session, questionId);
        assertThat(question.path("answerType").asText()).isEqualTo("MULTI_SELECT");
        assertThat(question.path("options")).hasSize(5);

        for (JsonNode option : question.path("options")) {
            assertThat(option.has("correct"))
                    .as("a student's view of an option carries no correctness at all")
                    .isFalse();
        }
    }

    @Test
    void aTickAllAnswerIsGradedAsASet() throws Exception {
        String admin = adminToken();
        long questionId = publishedTickAllQuestion(admin);
        long[] options = optionIdsOf(admin, questionId);

        String student = studentToken();

        // Every correct option, in a shuffled order: correct.
        assertThat(answer(student, sessionId(student), questionId, options[1], options[2], options[4])
                        .path("correct")
                        .asBoolean())
                .isTrue();

        // One missing: wrong.
        assertThat(answer(student, sessionId(student), questionId, options[1], options[2])
                        .path("correct")
                        .asBoolean())
                .isFalse();

        // One extra: wrong.
        assertThat(answer(student, sessionId(student), questionId, options[0], options[1], options[2], options[4])
                        .path("correct")
                        .asBoolean())
                .isFalse();
    }

    /** Deals a fresh round and returns just its id. */
    private long sessionId(String token) throws Exception {
        return startSession(token, 20).path("sessionId").asLong();
    }

    /**
     * The regression this class was written for. A review line lists each correct option once, in
     * the order the question showed them, however many of them the student ticked.
     */
    @Test
    void aTickAllReviewListsEachCorrectOptionExactlyOnce() throws Exception {
        String admin = adminToken();
        long questionId = publishedTickAllQuestion(admin);
        long[] options = optionIdsOf(admin, questionId);

        String student = studentToken();
        long sessionId = startSession(student, 20).path("sessionId").asLong();

        // Two of the three right answers, so the review has both a selection and a key to render
        // and the join has something to multiply.
        answer(student, sessionId, questionId, options[1], options[2]);

        JsonNode review = complete(student, sessionId);

        JsonNode line = null;
        for (JsonNode candidate : review.path("review")) {
            if (candidate.path("questionId").asLong() == questionId) {
                line = candidate;
            }
        }
        assertThat(line).as("the answered question should be in the review").isNotNull();

        assertThat(line.path("selectedOptions"))
                .as("what the student ticked, once each")
                .hasSize(2);
        assertThat(line.path("correctOptions"))
                .as("the answer key, once each and not multiplied by the join")
                .hasSize(3);

        assertThat(labelsOf(line.path("correctOptions")))
                .as("in the order the question showed them")
                .containsExactly("B", "C", "E");
        assertThat(labelsOf(line.path("selectedOptions"))).containsExactly("B", "C");
        assertThat(line.path("correct").asBoolean()).isFalse();
    }

    /** An unanswered question is still reviewed, because the screen lists every question. */
    @Test
    void anUnansweredQuestionReviewsAsEmptyRatherThanFailing() throws Exception {
        String admin = adminToken();
        long questionId = publishedTickAllQuestion(admin);

        String student = studentToken();
        long sessionId = startSession(student, 20).path("sessionId").asLong();

        JsonNode review = complete(student, sessionId);

        for (JsonNode line : review.path("review")) {
            assertThat(line.has("selectedOptions")).isTrue();
            if (line.path("questionId").asLong() == questionId) {
                assertThat(line.path("selectedOptions")).isEmpty();
                assertThat(line.path("correctOptions")).hasSize(3);
            }
        }
    }

    /**
     * Retiring is how a question leaves circulation, so it has to actually leave the dealt set.
     * Question 3 is the duplicate primes question retired by V7; both catalog queries filter on
     * PUBLISHED, and this asserts the effect through the app rather than by reading the column.
     */
    @Test
    void aRetiredQuestionIsNotDealtIntoASession() throws Exception {
        String student = studentToken();
        JsonNode session = startSession(student, 20);

        assertThat(session.path("questions"))
                .as("the topic should still deal its remaining questions")
                .isNotEmpty();

        for (JsonNode question : session.path("questions")) {
            assertThat(question.path("id").asLong())
                    .as("question 3 is retired and must not be dealt")
                    .isNotEqualTo(3L);
        }
    }

    // ------------------------------------------------------------------ helpers ---

    /** Creates and publishes a tick-all question on the seeded Number topic, and returns its id. */
    private long publishedTickAllQuestion(String admin) throws Exception {
        String prompt = "tickall " + System.nanoTime() + " tick every prime";

        MvcResult created = mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topicId":1,"prompt":"%s","explanation":"Because.","difficulty":1,
                                 "answerType":"MULTI_SELECT",
                                 "options":[
                                   {"text":"21","correct":false},
                                   {"text":"29","correct":true},
                                   {"text":"37","correct":true},
                                   {"text":"39","correct":false},
                                   {"text":"47","correct":true}]}
                                """.formatted(prompt)))
                .andExpect(status().isCreated())
                .andReturn();

        long id = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asLong();

        mockMvc.perform(post("/api/admin/questions/" + id + "/publish").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());

        return id;
    }

    /** The option ids in position order, as the editor sees them. ADMINS ONLY. */
    private long[] optionIdsOf(String admin, long questionId) throws Exception {
        JsonNode detail = body(mockMvc.perform(get("/api/admin/questions/" + questionId)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn());

        long[] ids = new long[detail.path("options").size()];
        for (int index = 0; index < ids.length; index++) {
            ids[index] = detail.path("options").get(index).path("id").asLong();
        }
        return ids;
    }

    private JsonNode startSession(String token, int count) throws Exception {
        return body(mockMvc.perform(post("/api/quiz/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicSlug\":\"number\",\"count\":%d}".formatted(count)))
                .andExpect(status().isCreated())
                .andReturn());
    }

    private JsonNode answer(String token, long sessionId, long questionId, long... optionIds) throws Exception {
        StringBuilder ids = new StringBuilder();
        for (long optionId : optionIds) {
            if (ids.length() > 0) {
                ids.append(',');
            }
            ids.append(optionId);
        }

        return body(mockMvc.perform(post("/api/quiz/sessions/" + sessionId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":%d,\"optionIds\":[%s],\"timeMs\":900}".formatted(questionId, ids)))
                .andExpect(status().isOk())
                .andReturn());
    }

    private JsonNode complete(String token, long sessionId) throws Exception {
        return body(mockMvc.perform(post("/api/quiz/sessions/" + sessionId + "/complete")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn());
    }

    private JsonNode findQuestion(JsonNode session, long questionId) {
        for (JsonNode question : session.path("questions")) {
            if (question.path("id").asLong() == questionId) {
                return question;
            }
        }
        throw new AssertionError("question " + questionId + " was not dealt into the session");
    }

    private static java.util.List<String> labelsOf(JsonNode options) {
        java.util.List<String> labels = new java.util.ArrayList<>();
        for (JsonNode option : options) {
            labels.add(option.path("label").asText());
        }
        return labels;
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String adminToken() {
        return tokenFor(Role.ADMIN);
    }

    private String studentToken() {
        return tokenFor(Role.STUDENT);
    }

    private String tokenFor(Role role) {
        User user = new User("quiz-" + role + "-" + System.nanoTime() + "@example.com", "Test User");
        user.setRole(role);
        return jwtService.issueFor(users.save(user)).token();
    }

    private static Path createTempDirectory() {
        try {
            return Files.createTempDirectory("realmaths-quiz-test");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
