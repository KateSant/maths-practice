-- Three questions the bank got wrong, found while writing the per-option messages.
--
-- Writing a message for every wrong option forces you to say what each one means, and that surfaced
-- three items with more than one defensible answer - the fault the spec's content QA calls "exactly
-- one defensible answer set". V11 loaded them and is applied, so it is frozen by its checksum and
-- cannot be edited; content/bank/*.json already holds the corrected versions, and this brings a
-- deployed database into line with them. V13 then fills in the messages, keyed on the prompt, which
-- is why this has to run first.
--
-- Each statement is scoped to origin = 'SEED' so it can only touch the bank, never a question a
-- teacher wrote.

-- 1. "Which expression is not equal to 3a + 2a?" offered 5 + a as well as 6a, and 5 + a is not equal
--    to 5a either - so two options answered the question. Replaced with 5 x a, which is equal to it.
update answer_options set text = '5 × a'
 where position = 4
   and question_id = (select id from questions
                       where prompt = 'Which expression is not equal to 3a + 2a?' and origin = 'SEED');

-- 2. "Find the sequence that does not have nth term 3n" had three answers, not one: 6, 9, 12, 15 is
--    3n + 3, 0, 3, 6, 9 is 3n - 3, and 3, 9, 27, 81 is geometric. Recast as the positive question,
--    which leaves exactly one sequence with nth term 3n.
--
--    The single-choice trigger refuses a second correct option, so the old key is cleared before the
--    new one is set: as written, each statement leaves the question with at most one.
update questions set prompt = 'Which sequence has nth term 3n?'
 where prompt = 'Find the sequence that does not have nth term 3n.' and origin = 'SEED';

update answer_options set is_correct = 0, misconception_code = 'SEQ-OFF-BY-ONE'
 where position = 1
   and question_id = (select id from questions
                       where prompt = 'Which sequence has nth term 3n?' and origin = 'SEED');

update answer_options set is_correct = 1, misconception_code = null
 where position = 2
   and question_id = (select id from questions
                       where prompt = 'Which sequence has nth term 3n?' and origin = 'SEED');

-- 3. "Which point lies on the line y = 2x + 1?" offered (0.5, 2) as a distractor, but 2 × 0.5 + 1 = 2,
--    so it lies on the line as well. Replaced with (2.5, 3.5), which is what adding 1 to x gives and
--    so catches the error the option was written for.
update answer_options set text = '(2.5, 3.5)'
 where position = 4
   and question_id = (select id from questions
                       where prompt = 'Which point lies on the line y = 2x + 1?' and origin = 'SEED');
