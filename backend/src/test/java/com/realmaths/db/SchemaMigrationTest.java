package com.realmaths.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Applies the real Flyway migrations to a throwaway SQLite file and verifies the
 * guarantees we care about.
 *
 * This exists because Hibernate's community SQLite dialect cannot reliably do
 * {@code ddl-auto=validate}, so we lost the automatic entity-vs-schema check. The
 * database-level guarantees are asserted here instead, which is a better home for
 * them: a failure shows up in CI with a readable report rather than crashing the
 * application at boot.
 */
class SchemaMigrationTest {

    @TempDir
    Path tempDir;

    private String jdbcUrl;

    @BeforeEach
    void applyMigrations() {
        jdbcUrl = "jdbc:sqlite:" + tempDir.resolve("schema-test.db") + "?foreign_keys=on";
        Flyway.configure()
                .dataSource(jdbcUrl, null, null)
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    @Test
    void seedsTheWholeStarterQuestionBank() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, "select count(*) from topics")).isEqualTo(5);
            assertThat(scalar(statement, "select count(*) from questions")).isEqualTo(33);
            assertThat(scalar(statement, "select count(*) from answer_options")).isEqualTo(133);
        }
    }

    /**
     * The SQLite replacement for the PL/pgSQL assertion that lived in the seed
     * migration: no question may be unanswerable or have a contradictory answer key.
     *
     * <p>Type-aware, because "exactly one correct" was only ever a rule for single-choice
     * questions. Every question still needs at least two options and at least one right answer;
     * the single-choice ceiling of one is what the trigger below enforces.
     */
    @Test
    void everySeededQuestionHasAnAnswerKeyItsTypeAllows() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            long broken = scalar(statement, """
                    select count(*) from questions q
                    where (select count(*) from answer_options o where o.question_id = q.id) < 2
                       or (select count(*) from answer_options o
                           where o.question_id = q.id and o.is_correct) = 0
                       or (q.answer_type = 'SINGLE_CHOICE'
                           and (select count(*) from answer_options o
                                where o.question_id = q.id and o.is_correct) <> 1)
                    """);
            assertThat(broken).as("questions with a malformed option set").isZero();
        }
    }

    /**
     * The 32 original questions are all single choices and were all written with four options.
     * Worth pinning separately, because the general check above is now loose enough to permit a
     * seed question that quietly lost an option.
     */
    @Test
    void theOriginalSeededQuestionsEachStillHaveFourOptions() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, """
                    select count(*) from questions q
                    where q.answer_type = 'SINGLE_CHOICE'
                      and (select count(*) from answer_options o where o.question_id = q.id) <> 4
                    """))
                    .as("single-choice seed questions without exactly four options")
                    .isZero();
        }
    }

    /**
     * The at-most-one-correct guarantee, which used to be the unconditional partial unique index
     * answer_options_one_correct_idx and is now the answer_options_single_choice_insert trigger.
     */
    @Test
    void sqliteRefusesASecondCorrectOptionOnASingleChoiceQuestion() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate("""
                    insert into answer_options (question_id, position, label, text, is_correct)
                    values (1, 5, 'E', 'a second right answer', 1)
                    """))
                    .as("question 1 is a single choice, so the trigger should reject this")
                    .isInstanceOf(SQLException.class);
        }
    }

    /**
     * The same guarantee, reached by flipping a flag rather than inserting a row. No application
     * code does this - create and update rebuild the option set - so the trigger exists for a
     * direct SQL edit and for a future importer.
     */
    @Test
    void sqliteRefusesFlippingASecondOptionCorrectOnASingleChoiceQuestion() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            // Question 1's correct option is position 3, so position 2 is a second one.
            assertThatThrownBy(() -> statement.executeUpdate(
                            "update answer_options set is_correct = 1 where question_id = 1 and position = 2"))
                    .as("the trigger should reject this")
                    .isInstanceOf(SQLException.class);
        }
    }

    /** The other half: a tick-all question is allowed as many right answers as it likes. */
    @Test
    void sqliteAllowsSeveralCorrectOptionsOnATickAllQuestion() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            // Question 33 is the seeded tick-all example and already has three correct options.
            statement.executeUpdate("""
                    insert into answer_options (question_id, position, label, text, is_correct)
                    values (33, 6, 'F', '53', 1)
                    """);

            assertThat(scalar(statement, """
                    select count(*) from answer_options where question_id = 33 and is_correct
                    """))
                    .as("correct options on the tick-all question")
                    .isEqualTo(4);
        }
    }

    /**
     * The answer type is a new column defaulting to SINGLE_CHOICE, so the 32 questions written
     * before tick-all existed keep their meaning without a backfill.
     */
    @Test
    void everyOriginalSeededQuestionIsASingleChoice() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, """
                    select count(*) from questions
                    where id <> 33 and answer_type = 'SINGLE_CHOICE'
                    """))
                    .as("questions from before tick-all existed")
                    .isEqualTo(32);
            assertThat(text(statement, "select answer_type from questions where id = 33"))
                    .isEqualTo("MULTI_SELECT");
        }
    }

    /**
     * The one tick-all question in the prototype bank, which is how the new type is reachable
     * without authoring anything first.
     */
    @Test
    void theStarterBankIncludesATickAllExample() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, """
                    select count(*) from answer_options where question_id = 33 and is_correct
                    """))
                    .as("correct options on the tick-all example")
                    .isEqualTo(3);
            assertThat(text(statement, "select status from questions where id = 33")).isEqualTo("PUBLISHED");
            assertThat(text(statement, "select origin from questions where id = 33")).isEqualTo("SEED");
        }
    }

    /**
     * The selected answers moved out of quiz_answers.selected_option_id and into their own table,
     * because an answer is a set now. The column is dropped rather than left beside the table.
     */
    @Test
    void theSingleSelectedOptionColumnIsReplacedByASelectionTable() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeQuery("select selected_option_id from quiz_answers limit 1"))
                    .as("quiz_answers.selected_option_id should have been dropped")
                    .isInstanceOf(SQLException.class);

            // Still there and still enforced, so an answer cannot select an option that is not.
            assertThatThrownBy(() -> statement.executeUpdate("""
                    insert into quiz_answer_options (answer_id, option_id) values (999999, 1)
                    """))
                    .as("a selection pointing at a missing answer should be rejected")
                    .isInstanceOf(SQLException.class);
        }
    }

    /** Proves {@code foreign_keys=on} is actually in effect: SQLite ignores FKs by default. */
    @Test
    void foreignKeysAreEnforced() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate("""
                    insert into answer_options (question_id, position, label, text, is_correct)
                    values (999999, 1, 'A', 'orphan', 0)
                    """))
                    .as("an option pointing at a missing question should be rejected")
                    .isInstanceOf(SQLException.class);
        }
    }

    /**
     * Replaces the Postgres {@code setval()} calls: inserting explicit seed ids must
     * leave AUTOINCREMENT positioned past them, or the next insert collides.
     */
    @Test
    void generatedIdsContinueAfterTheExplicitlySeededIds() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    insert into questions (topic_id, prompt, explanation, difficulty)
                    values (1, 'A brand new question', 'Because', 1)
                    """);
            assertThat(scalar(statement, "select max(id) from questions"))
                    .as("new question id")
                    .isGreaterThan(33);

            statement.executeUpdate("""
                    insert into topics (slug, name, description, sort_order)
                    values ('brand-new', 'Brand New', 'x', 9)
                    """);
            assertThat(scalar(statement, "select max(id) from topics"))
                    .as("new topic id")
                    .isGreaterThan(5);
        }
    }

    /** A data-change migration must not need a foreign key to a row that is not there. */
    @Test
    void deletingAQuestionCascadesToItsOptions() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("delete from questions where id = 1");
            assertThat(scalar(statement, "select count(*) from answer_options where question_id = 1"))
                    .as("options of the deleted question")
                    .isZero();
        }
    }

    /**
     * Regression guard: sqlite-jdbc encodes an Instant as epoch milliseconds, so the
     * SQL defaults must produce the same. SQLite's own current_timestamp would store
     * TEXT, leaving one column holding both TEXT (seeded) and INTEGER (written by JPA)
     * - which reads back fine but silently breaks ordering and date comparisons.
     */
    @Test
    void sqlDefaultsStoreTimestampsTheSameWayTheDriverDoes() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            // Rows inserted by the migration's DEFAULT:
            assertThat(text(statement, "select typeof(created_at) from questions limit 1"))
                    .as("questions.created_at written by the SQL default")
                    .isEqualTo("integer");

            // A row relying purely on the column default, as a future JPA insert would:
            statement.executeUpdate("""
                    insert into users (email, display_name)
                    values ('typeof@example.com', 'T')
                    """);
            assertThat(text(statement, "select typeof(created_at) from users"))
                    .as("users.created_at written by the SQL default")
                    .isEqualTo("integer");
        }
    }

    /**
     * Identity is keyed on the provider's own subject, so one Google account can only
     * ever map to one user row. This is what makes sign-in idempotent rather than a
     * duplicate-account factory, and it is enforced here rather than in service code
     * because that is where it cannot be bypassed.
     */
    @Test
    void sqliteRefusesTheSameProviderSubjectMappingToASecondUser() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("insert into users (email, display_name) values ('one@example.com', 'One')");
            statement.executeUpdate("insert into users (email, display_name) values ('two@example.com', 'Two')");
            statement.executeUpdate("""
                    insert into user_identities (user_id, provider, subject, email_at_provider)
                    values ((select id from users where email = 'one@example.com'),
                            'google', 'sub-123', 'one@example.com')
                    """);

            assertThatThrownBy(() -> statement.executeUpdate("""
                    insert into user_identities (user_id, provider, subject, email_at_provider)
                    values ((select id from users where email = 'two@example.com'),
                            'google', 'sub-123', 'two@example.com')
                    """))
                    .as("the same Google subject must not map to a second user")
                    .isInstanceOf(SQLException.class);
        }
    }

    /** The password path was removed outright, so the column must be gone too. */
    @Test
    void thePasswordHashColumnNoLongerExists() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeQuery("select password_hash from users limit 1"))
                    .as("users.password_hash should have been dropped")
                    .isInstanceOf(SQLException.class);
        }
    }

    // ------------------------------------------------- question lifecycle (V4) ---

    @Test
    void theActiveColumnIsReplacedByStatus() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeQuery("select active from questions limit 1"))
                    .as("questions.active should have been dropped")
                    .isInstanceOf(SQLException.class);

            // The 32 seeded questions were all published before the change. V6 then added a
            // tick-all example and V7 retired one of the originals, so the published total is back
            // to 32: 31 of the originals plus the V6 example. What this test really guards is that
            // nothing is left unpublished by accident, so the number is asserted rather than
            // derived - a silent extra RETIRED row would show up here.
            assertThat(scalar(statement, "select count(*) from questions where status = 'PUBLISHED'"))
                    .isEqualTo(32);
        }
    }

    /** Makes "retire the whole prototype bank" one action instead of a review of the list. */
    @Test
    void theStarterQuestionsAreMarkedAsSeedContent() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, "select count(*) from questions where origin = 'SEED'"))
                    .isEqualTo(33);
        }
    }

    /**
     * A new row defaults to DRAFT, so a forgotten INSERT leaves an unpublished question rather
     * than putting half-written content in front of a student. It also defaults to
     * SINGLE_CHOICE, so a forgotten INSERT cannot invent a tick-all question by accident.
     */
    @Test
    void aNewQuestionDefaultsToDraftAndAuthored() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "insert into questions (topic_id, prompt, explanation, difficulty) values (1, 'brand new', 'x', 1)");

            assertThat(text(statement, "select status from questions where prompt = 'brand new'"))
                    .isEqualTo("DRAFT");
            assertThat(text(statement, "select origin from questions where prompt = 'brand new'"))
                    .isEqualTo("AUTHORED");
            assertThat(text(statement, "select answer_type from questions where prompt = 'brand new'"))
                    .isEqualTo("SINGLE_CHOICE");
        }
    }

    @Test
    void sqliteRefusesAnUnknownAnswerType() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate(
                            "update questions set answer_type = 'GUESS_ONE' where id = 1"))
                    .as("the check constraint should reject this")
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void sqliteRefusesAnUnknownQuestionStatus() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate(
                            "update questions set status = 'NONSENSE' where id = 1"))
                    .as("the check constraint should reject this")
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void deletingAUserCascadesToTheirIdentities() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("insert into users (email, display_name) values ('gone@example.com', 'Gone')");
            statement.executeUpdate("""
                    insert into user_identities (user_id, provider, subject, email_at_provider)
                    values ((select id from users where email = 'gone@example.com'),
                            'google', 'sub-999', 'gone@example.com')
                    """);

            statement.executeUpdate("delete from users where email = 'gone@example.com'");

            assertThat(scalar(statement, "select count(*) from user_identities"))
                    .as("identities of the deleted user")
                    .isZero();
        }
    }

    // ------------------------------------------- retiring the duplicate (V7) ---

    /**
     * The old single-choice primes question is retired, not deleted. It carries recorded answers,
     * and {@code quiz_answers.question_id} is {@code on delete cascade}, so a DELETE would have
     * taken them with it.
     */
    @Test
    void theDuplicatePrimesQuestionIsRetiredRatherThanDeleted() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(text(statement, "select status from questions where id = 3")).isEqualTo("RETIRED");

            // Still there with its options, so the answers already recorded against it and any
            // completed review that shows it still resolve rather than 404ing.
            assertThat(scalar(statement, "select count(*) from answer_options where question_id = 3"))
                    .as("options of the retired question")
                    .isEqualTo(4);
        }
    }

    /**
     * And it is out of the dealt set, which is what "gone" means here: both catalog queries filter
     * on PUBLISHED, so retiring is sufficient and no delete is needed.
     */
    @Test
    void aRetiredQuestionIsNoLongerPublishedForDealing() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, """
                    select count(*) from questions where topic_id = 1 and status = 'PUBLISHED'
                    """))
                    .as("published questions left in the Number topic")
                    .isEqualTo(7);
            assertThat(scalar(statement, """
                    select count(*) from questions where topic_id = 1 and status = 'PUBLISHED' and id = 3
                    """))
                    .isZero();
        }
    }

    private Connection open() throws SQLException {
        return DriverManager.getConnection(jdbcUrl);
    }

    private static long scalar(Statement statement, String sql) throws SQLException {
        try (ResultSet resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private static String text(Statement statement, String sql) throws SQLException {
        try (ResultSet resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getString(1);
        }
    }
}
