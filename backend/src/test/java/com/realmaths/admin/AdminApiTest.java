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

    /**
     * The question bank shows which year group each question belongs to, and can be narrowed to
     * one. This is the admin half of the feature: without it, a teacher cannot see or change the
     * sets the dropdown deals from.
     */
    @Test
    void questionsAreFiledAndFilteredByYearGroup() throws Exception {
        String admin = adminToken();
        String marker = "yeargroup" + System.nanoTime();

        // No year group sent: filed in Year 7, matching the column default. That is what every
        // question written before this feature existed now is.
        long legacy = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question(marker + " no year sent", "4", "5")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.yearGroup").value(7))
                .andReturn());

        long higher = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionInYear(9, marker + " year nine", "4", "5")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.yearGroup").value(9))
                .andReturn());

        mockMvc.perform(get("/api/admin/questions?yearGroup=9&q=" + marker)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(higher));

        mockMvc.perform(get("/api/admin/questions?yearGroup=7&q=" + marker)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(legacy));

        // An edit can move a question to another year group.
        mockMvc.perform(put("/api/admin/questions/" + legacy)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionInYear(11, marker + " moved", "4", "5")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.yearGroup").value(11));
    }

    @Test
    void aYearGroupOutsideSevenToThirteenIsRejected() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionInYear(14, "too far")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.yearGroup").exists());

        mockMvc.perform(get("/api/admin/questions?yearGroup=99").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
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

    // ---------------------------------------------------- misconception codes (V9) ---

    /**
     * A wrong option's misconception code survives the round trip through save and reload.
     *
     * <p>The code is the bank's diagnostic value: it is what lets the teacher be told that a wrong
     * pick means "adds the numerators and the denominators" rather than only that it was wrong. It
     * is stored per option, so an edit - which replaces the whole option set - must rebuild the tag
     * with it rather than dropping it as unrecognised metadata. A correct option carries none, and
     * an absent one is omitted from the JSON rather than sent as an empty string.
     */
    @Test
    void aMisconceptionCodeSurvivesSavingAndReloading() throws Exception {
        String admin = adminToken();
        String marker = "misconception" + System.nanoTime();

        long id = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionWithCodes(
                                marker + " what is 1/2 + 1/3?",
                                new String[] {"2/5", "5/6"},
                                new String[] {"FRAC-ADD-ACROSS", null})))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.options[0].misconceptionCode").value("FRAC-ADD-ACROSS"))
                // A correct option catches nothing, so the field is absent rather than empty.
                .andExpect(jsonPath("$.options[1].misconceptionCode").doesNotExist())
                .andReturn());

        // An edit replaces the option set. The tag has to be rebuilt with it.
        mockMvc.perform(put("/api/admin/questions/" + id)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionWithCodes(
                                marker + " what is 2/5 + 1/5?",
                                new String[] {"3/10", "3/5"},
                                new String[] {"FRAC-ADD-DENOM", null})))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options[0].misconceptionCode").value("FRAC-ADD-DENOM"));

        mockMvc.perform(get("/api/admin/questions/" + id).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options[0].misconceptionCode").value("FRAC-ADD-DENOM"));
    }

    /**
     * A code that is not in the register is stored, not refused.
     *
     * <p>Deliberate, and the same decision the schema makes: the register is content
     * (content/misconceptions.json), revised in the repository, so a code retired there must not
     * make an old question unsavable. The editor only offers registered codes, and the teacher's
     * diagnosis panel names an unrecognised one, which is where a bad code should be caught.
     */
    @Test
    void anUnknownMisconceptionCodeIsStoredRatherThanRejected() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionWithCodes(
                                "unknown code " + System.nanoTime(),
                                new String[] {"a", "b"},
                                new String[] {"NOT-A-REAL-CODE", null})))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.options[0].misconceptionCode").value("NOT-A-REAL-CODE"));

        // An empty string is "catches nothing", and is stored as absent rather than as "".
        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(questionWithCodes(
                                "blank code " + System.nanoTime(),
                                new String[] {"a", "b"},
                                new String[] {"   ", null})))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.options[0].misconceptionCode").doesNotExist());
    }

    // ------------------------------------------------- tick all that apply (V6) ---

    /**
     * The point of the whole feature, through the real API: two right answers on a tick-all
     * question are accepted by the service, by the publish gate and by the database trigger that
     * replaced the old unconditional partial unique index.
     */
    @Test
    void aTickAllQuestionCanBeSavedAndPublishedWithSeveralCorrectOptions() throws Exception {
        String admin = adminToken();
        String marker = "tickall" + System.nanoTime();

        long id = idOf(mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tickAllQuestion(
                                marker + " tick every prime", new int[] {1, 2}, "21", "29", "37", "39")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.answerType").value("MULTI_SELECT"))
                // Labels still derived from position, and the key survives the round trip.
                .andExpect(jsonPath("$.options[0].label").value("A"))
                .andExpect(jsonPath("$.options[1].correct").value(true))
                .andExpect(jsonPath("$.options[2].correct").value(true))
                .andExpect(jsonPath("$.options[3].correct").value(false))
                .andReturn());

        mockMvc.perform(post("/api/admin/questions/" + id + "/publish").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        // Still a tick-all question after the reload the editor does.
        mockMvc.perform(get("/api/admin/questions/" + id).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answerType").value("MULTI_SELECT"))
                .andExpect(jsonPath("$.options[1].correct").value(true));
    }

    /**
     * The mirror image. Two right answers on a single-choice question are refused at save, which is
     * where the database trigger fires, and the teacher is told which input to fix rather than
     * being handed the generic 409 a raw constraint violation would produce.
     */
    @Test
    void aSingleChoiceQuestionCannotBeSavedWithTwoCorrectOptions() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question("Two right answers", new int[] {0, 1}, "4", "5")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors['options.correct']").exists());
    }

    /**
     * An omitted answer type is a client written before tick-all existed, and what it means is a
     * single choice - not an error, and not a coin flip.
     */
    @Test
    void anOmittedAnswerTypeDefaultsToASingleChoice() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(question("No answer type sent", 0, "4", "5")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.answerType").value("SINGLE_CHOICE"));
    }

    @Test
    void anUnknownAnswerTypeIsRejectedAsAClientError() throws Exception {
        String admin = adminToken();

        mockMvc.perform(post("/api/admin/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topicId":1,"prompt":"x","explanation":null,"difficulty":1,
                                 "answerType":"GUESS_ONE",
                                 "options":[{"text":"a","correct":true},{"text":"b","correct":false}]}
                                """))
                .andExpect(status().isBadRequest());
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
        return question(prompt, new int[] {0}, options);
    }

    /** A question filed in a chosen year group, rather than defaulting to Year 7. */
    private static String questionInYear(int yearGroup, String prompt, String... options) {
        return questionJson(yearGroup, prompt, null, options, new int[] {0});
    }

    /** @param correctIndex which option is the right answer, zero-based */
    private static String question(String prompt, int correctIndex, String... options) {
        return question(prompt, new int[] {correctIndex}, options);
    }

    /** @param correctIndexes which options are right answers, zero-based */
    private static String question(String prompt, int[] correctIndexes, String... options) {
        return questionJson(null, prompt, null, options, correctIndexes);
    }

    /**
     * A tick-all question. The answer type is spelled out, because the point of these tests is that
     * the API accepts more than one correct option when and only when a question says it has more
     * than one.
     */
    private static String tickAllQuestion(String prompt, int[] correctIndexes, String... options) {
        return questionJson(null, prompt, "MULTI_SELECT", options, correctIndexes);
    }

    /**
     * @param yearGroup the year group to file the question in, or null to leave the field out and
     *     let the column default (Year 7) decide
     * @param answerType null for a single-choice question, which is also what omitting the field
     *     means to the API
     */
    private static String questionJson(
            Integer yearGroup, String prompt, String answerType, String[] options, int[] correctIndexes) {
        String yearField = yearGroup == null ? "" : "\"yearGroup\":" + yearGroup + ",";
        StringBuilder json = new StringBuilder("""
                {"topicId":1,"prompt":"%s","explanation":"Because.","difficulty":2,%s%s"options":[
                """.formatted(prompt, yearField, answerType == null ? "" : "\"answerType\":\"" + answerType + "\","));
        for (int index = 0; index < options.length; index++) {
            if (index > 0) {
                json.append(',');
            }
            json.append("{\"text\":\"%s\",\"correct\":%s}"
                    .formatted(options[index], contains(correctIndexes, index)));
        }
        return json.append("]}").toString();
    }

    private static boolean contains(int[] indexes, int value) {
        return java.util.Arrays.stream(indexes).anyMatch(index -> index == value);
    }

    /**
     * A single-choice question whose options each carry an optional misconception code. Index 1 is
     * the correct option, so index 0 is the distractor that normally carries a code; a null entry
     * omits the field entirely, which is what a correct option and an undiagnosed distractor both
     * look like.
     */
    private static String questionWithCodes(String prompt, String[] options, String[] codes) {
        StringBuilder json = new StringBuilder("""
                {"topicId":1,"prompt":"%s","explanation":"Because.","difficulty":2,"options":[
                """.formatted(prompt));
        for (int index = 0; index < options.length; index++) {
            if (index > 0) {
                json.append(',');
            }
            String code = codes[index];
            json.append("{\"text\":\"%s\",\"correct\":%s%s}"
                    .formatted(
                            options[index],
                            index == 1,
                            code == null ? "" : ",\"misconceptionCode\":\"" + code + "\""));
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
