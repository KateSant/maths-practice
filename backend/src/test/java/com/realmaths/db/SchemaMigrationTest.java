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
                    insert into users (email, password_hash, display_name)
                    values ('typeof@example.com', 'x', 'T')
                    """);
            assertThat(text(statement, "select typeof(created_at) from users"))
                    .as("users.created_at written by the SQL default")
                    .isEqualTo("integer");
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
