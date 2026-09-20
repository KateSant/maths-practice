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
            assertThat(scalar(statement, "select count(*) from questions")).isEqualTo(32);
            assertThat(scalar(statement, "select count(*) from answer_options")).isEqualTo(128);
        }
    }

    /**
     * The SQLite replacement for the PL/pgSQL assertion that lived in the seed
     * migration: no question may be unanswerable or have two right answers.
     */
    @Test
    void everyQuestionHasFourOptionsAndExactlyOneCorrectAnswer() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            long broken = scalar(statement, """
                    select count(*) from questions q
                    where (select count(*) from answer_options o where o.question_id = q.id) <> 4
                       or (select count(*) from answer_options o
                           where o.question_id = q.id and o.is_correct) <> 1
                    """);
            assertThat(broken).as("questions with a malformed option set").isZero();
        }
    }

    @Test
    void sqliteRefusesASecondCorrectOptionForTheSameQuestion() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate("""
                    insert into answer_options (question_id, position, label, text, is_correct)
                    values (1, 5, 'E', 'a second right answer', 1)
                    """))
                    .as("the partial unique index should reject this")
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
                    .isGreaterThan(32);

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

            // The 32 seeded questions were all published before the change, and must still be.
            assertThat(scalar(statement, "select count(*) from questions where status = 'PUBLISHED'"))
                    .isEqualTo(32);
        }
    }

    /** Makes "retire the whole prototype bank" one action instead of a review of the list. */
    @Test
    void theStarterQuestionsAreMarkedAsSeedContent() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, "select count(*) from questions where origin = 'SEED'"))
                    .isEqualTo(32);
        }
    }

    /**
     * A new row defaults to DRAFT, so a forgotten INSERT leaves an unpublished question rather
     * than putting half-written content in front of a student.
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

    // ---------------------------------------------------------- year groups (V7) ---

    /**
     * The starter bank was written for the first year of secondary school, so it is Year 7
     * content. This is what makes "all the questions we already have are in Year 7" true rather
     * than an assumption: the migration's default assigned them, and nothing has moved one since.
     */
    @Test
    void theStarterQuestionsAreYearSevenContent() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThat(scalar(statement, "select count(*) from questions where year_group = 7"))
                    .isEqualTo(32);
        }
    }

    /** An INSERT that predates year groups still lands in Year 7 rather than nowhere. */
    @Test
    void aNewQuestionDefaultsToYearSeven() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "insert into questions (topic_id, prompt, explanation, difficulty) values (1, 'no year given', 'x', 1)");

            assertThat(scalar(statement, "select year_group from questions where prompt = 'no year given'"))
                    .isEqualTo(7);
        }
    }

    @Test
    void sqliteRefusesAYearGroupOutsideSevenToThirteen() throws Exception {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate("update questions set year_group = 14 where id = 1"))
                    .as("the check constraint should reject a year above 13")
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> statement.executeUpdate("update questions set year_group = 6 where id = 1"))
                    .as("the check constraint should reject a year below 7")
                    .isInstanceOf(SQLException.class);

            // The session's copy of the year group is held to the same range.
            statement.executeUpdate("insert into users (email, display_name) values ('y@example.com', 'Y')");
            assertThatThrownBy(() -> statement.executeUpdate("""
                    insert into quiz_sessions (user_id, topic_id, question_count, year_group)
                    values ((select id from users where email = 'y@example.com'), 1, 5, 14)
                    """))
                    .as("a session cannot have been dealt from an invented year")
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
