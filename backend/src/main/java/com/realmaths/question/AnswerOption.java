package com.realmaths.question;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "answer_options")
public class AnswerOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    // See User.id for why this override is needed on SQLite.
    @JdbcTypeCode(SqlTypes.INTEGER)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false, length = 4)
    private String label;

    @Column(nullable = false, length = 500)
    private String text;

    /**
     * Stays on the server. The API never serialises an entity directly, precisely
     * so this flag cannot leak to a student poking at the network tab.
     */
    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    /**
     * The error this wrong option was written to catch, as a code from
     * {@code content/misconceptions.json} ("FRAC-ADD-ACROSS", "PV-COLUMN-NAME", ...).
     *
     * <p>Nullable and unconstrained, deliberately. A correct option catches nothing, most
     * questions a teacher writes carry no code at all, and the register is content rather than
     * schema - it is revised in the repository, so a retired code must not leave a constraint
     * behind. The column is populated by the bank migration (V9) and read back as the teacher's
     * explanation of what a wrong pick means.
     */
    @Column(name = "misconception_code", length = 60)
    private String misconceptionCode;

    /**
     * The message a student reads when they pick this wrong option, written with the question.
     *
     * <p>A misconception code names an error class, and one class can cover two options in the same
     * question that are different misreadings - 0.2 (tenths) and 0.002 (thousandths) both catch
     * PV-COLUMN-NAME. So the sentence that says "on the question you think you were asked, 0.2 is
     * the right answer" belongs to the option. Nullable: a correct option explains nothing away,
     * and a teacher's option may carry only a code, in which case the register's line stands in.
     */
    @Column(length = 500)
    private String feedback;

    protected AnswerOption() {
        // for JPA
    }

    public AnswerOption(Question question, int position, String label, String text, boolean correct) {
        this(question, position, label, text, correct, null, null);
    }

    public AnswerOption(
            Question question, int position, String label, String text, boolean correct, String misconceptionCode) {
        this(question, position, label, text, correct, misconceptionCode, null);
    }

    public AnswerOption(
            Question question,
            int position,
            String label,
            String text,
            boolean correct,
            String misconceptionCode,
            String feedback) {
        this.question = question;
        this.position = position;
        this.label = label;
        this.text = text;
        this.correct = correct;
        this.misconceptionCode = misconceptionCode;
        this.feedback = feedback;
    }

    public Long getId() {
        return id;
    }

    public Question getQuestion() {
        return question;
    }

    public int getPosition() {
        return position;
    }

    public String getLabel() {
        return label;
    }

    public String getText() {
        return text;
    }

    public boolean isCorrect() {
        return correct;
    }

    /** The misconception code this option catches, or null when it catches none. */
    public String getMisconceptionCode() {
        return misconceptionCode;
    }

    /** The message a student reads for this option, or null when it carries none. */
    public String getFeedback() {
        return feedback;
    }

    /**
     * Applies an edit to an option in place, keeping its row and therefore its id.
     *
     * <p>The id is what a recorded answer points at ({@code quiz_answer_options.option_id}), and
     * that link cascades on delete. Rebuilding the option set - which is what this replaced -
     * deleted these rows and took every recorded pick with them, so fixing a typo in a question
     * silently destroyed the misconception history for it. Editing in place leaves the id alone, so
     * a text change or a re-coding keeps the answers that point at it.
     */
    public void revise(String text, boolean correct, String misconceptionCode, String feedback) {
        this.text = text;
        this.correct = correct;
        this.misconceptionCode = misconceptionCode;
        this.feedback = feedback;
    }

    /**
     * Clears the correct flag, on its own.
     *
     * <p>Separate from {@link #revise} because the single-choice trigger refuses a second correct
     * option per statement: moving the key from one option to another has to pass through a moment
     * where none is marked. Callers clear every option, flush, then set the flags they want.
     */
    public void markIncorrect() {
        this.correct = false;
    }
}
