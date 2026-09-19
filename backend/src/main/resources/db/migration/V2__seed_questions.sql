-- Starter question bank so the prototype is usable before the real content arrives.
--
-- These are intentionally written as plain INSERTs with explicit ids so that
-- question 7 is always the same question 7 while developing. SQLite advances
-- sqlite_sequence past the explicit ids automatically, so the next generated row
-- continues from 33 without any Postgres-style setval() call.
-- When the maths teacher supplies real content we will load it through the admin
-- API / CSV import instead of growing this file.
--
-- Option ids follow the pattern question_id * 10 + position, which keeps them
-- predictable and makes the correctness flags easy to audit by eye.

insert into topics (id, slug, name, description, sort_order) values
  (1, 'number',    'Number & Place Value',            'Place value, rounding, primes, order of operations and negative numbers.', 1),
  (2, 'fractions', 'Fractions, Decimals & Percentages', 'Equivalent fractions, arithmetic with fractions and percentage change.',  2),
  (3, 'algebra',   'Algebra',                          'Simplifying, expanding, factorising and solving equations.',              3),
  (4, 'geometry',  'Geometry & Measures',              'Angles, area, perimeter and volume.',                                     4),
  (5, 'data',      'Probability & Statistics',         'Averages, range and simple probability.',                                 5);

insert into questions (id, topic_id, prompt, explanation, difficulty) values
  -- Number & Place Value
  ( 1, 1, 'What is the value of the digit 7 in the number 4,782?',
          'The 7 is in the hundreds column, so it is worth 7 × 100 = 700.', 1),
  ( 2, 1, 'Round 3,486 to the nearest hundred.',
          'The tens digit is 8, which is 5 or more, so round the hundreds digit up from 4 to 5.', 1),
  ( 3, 1, 'Which of these numbers is prime?',
          '29 has no factors other than 1 and itself. 21 = 3 × 7, 27 = 3 × 9 and 33 = 3 × 11.', 2),
  ( 4, 1, 'Work out 15 + 6 × 4.',
          'Multiplication is done before addition: 6 × 4 = 24, then 15 + 24 = 39.', 2),
  ( 5, 1, 'What is −7 + 12?',
          'Start at −7 and move 12 places to the right on a number line to reach 5.', 2),
  ( 6, 1, 'What is the highest common factor (HCF) of 24 and 36?',
          '24 = 2³ × 3 and 36 = 2² × 3², so the HCF is 2² × 3 = 12.', 3),
  ( 7, 1, 'Write 0.045 as a fraction in its simplest form.',
          '0.045 = 45/1000. Divide the numerator and denominator by 5 to get 9/200.', 3),

  -- Fractions, Decimals & Percentages
  ( 8, 2, 'What is 1/2 + 1/4?',
          'Write both with a denominator of 4: 2/4 + 1/4 = 3/4.', 1),
  ( 9, 2, 'Which fraction is equivalent to 0.6?',
          '0.6 = 6/10, which simplifies to 3/5 by dividing top and bottom by 2.', 1),
  (10, 2, 'What is 25% of 240?',
          '25% is one quarter, and 240 ÷ 4 = 60.', 2),
  (11, 2, 'Work out 3/5 × 10.',
          '10 ÷ 5 = 2, then 3 × 2 = 6. Equivalently 3/5 × 10 = 30/5 = 6.', 2),
  (12, 2, 'Increase 80 by 15%.',
          '10% of 80 = 8 and 5% of 80 = 4, so 15% = 12. Then 80 + 12 = 92.', 2),
  (13, 2, 'What is 2/3 ÷ 4/9?',
          'Dividing by 4/9 is the same as multiplying by 9/4: 2/3 × 9/4 = 18/12 = 3/2.', 3),
  (14, 2, 'In a sale a jacket costs £45 after a 25% discount. What was the original price?',
          '£45 is 75% of the original price, so the original is 45 ÷ 0.75 = £60.', 3),

  -- Algebra
  (15, 3, 'Simplify 3a + 5a.',
          'Both terms are like terms in a, so add the coefficients: 3 + 5 = 8, giving 8a.', 1),
  (16, 3, 'Solve x + 7 = 15.',
          'Subtract 7 from both sides: x = 15 − 7 = 8.', 1),
  (17, 3, 'Solve 4x − 5 = 27.',
          'Add 5 to both sides to get 4x = 32, then divide by 4 to get x = 8.', 2),
  (18, 3, 'Expand 3(2x + 4).',
          'Multiply each term inside the bracket by 3: 3 × 2x = 6x and 3 × 4 = 12.', 2),
  (19, 3, 'Solve 5x + 3 = 2x + 18.',
          'Subtract 2x from both sides: 3x + 3 = 18. Subtract 3: 3x = 15, so x = 5.', 3),
  (20, 3, 'If y = 3x² − 1, find y when x = 4.',
          'First 4² = 16, then 3 × 16 = 48, and finally 48 − 1 = 47.', 3),
  (21, 3, 'Factorise x² + 7x + 12.',
          'We need two numbers that multiply to 12 and add to 7: they are 3 and 4.', 3),

  -- Geometry & Measures
  (22, 4, 'How many degrees are there in a straight line?',
          'Angles on a straight line add up to 180°.', 1),
  (23, 4, 'What is the area of a rectangle measuring 8 cm by 5 cm?',
          'Area of a rectangle = length × width = 8 × 5 = 40 cm².', 1),
  (24, 4, 'Two angles of a triangle are 65° and 48°. What is the third angle?',
          'Angles in a triangle add to 180°, so 180 − 65 − 48 = 67°.', 2),
  (25, 4, 'What is the circumference of a circle with radius 5 cm? (Use π = 3.14)',
          'Circumference = 2πr = 2 × 3.14 × 5 = 31.4 cm.', 2),
  (26, 4, 'What is the area of a triangle with base 12 cm and perpendicular height 7 cm?',
          'Area = ½ × base × height = ½ × 12 × 7 = 42 cm².', 2),
  (27, 4, 'What is the volume of a cuboid measuring 4 cm by 3 cm by 5 cm?',
          'Volume = length × width × height = 4 × 3 × 5 = 60 cm³.', 3),

  -- Probability & Statistics
  (28, 5, 'A fair six-sided die is rolled once. What is the probability of rolling a 4?',
          'There is one favourable outcome out of six equally likely outcomes, so 1/6.', 1),
  (29, 5, 'What is the mean of 4, 8, 6 and 10?',
          'Add the values and divide by how many there are: (4 + 8 + 6 + 10) ÷ 4 = 28 ÷ 4 = 7.', 1),
  (30, 5, 'What is the median of 3, 7, 9, 4 and 11?',
          'Put them in order: 3, 4, 7, 9, 11. The middle value is 7.', 2),
  (31, 5, 'A fair coin is flipped twice. What is the probability of getting heads both times?',
          'The flips are independent, so multiply: 1/2 × 1/2 = 1/4.', 2),
  (32, 5, 'What is the range of 12, 5, 19 and 7?',
          'Range = largest − smallest = 19 − 5 = 14.', 3);

insert into answer_options (id, question_id, position, label, text, is_correct) values
  -- Q1
  ( 11,  1, 1, 'A', '7',     false), ( 12,  1, 2, 'B', '70',    false),
  ( 13,  1, 3, 'C', '700',   true ), ( 14,  1, 4, 'D', '7,000', false),
  -- Q2
  ( 21,  2, 1, 'A', '3,400', false), ( 22,  2, 2, 'B', '3,500', true ),
  ( 23,  2, 3, 'C', '3,490', false), ( 24,  2, 4, 'D', '3,600', false),
  -- Q3
  ( 31,  3, 1, 'A', '21', false),    ( 32,  3, 2, 'B', '29', true ),
  ( 33,  3, 3, 'C', '27', false),    ( 34,  3, 4, 'D', '33', false),
  -- Q4
  ( 41,  4, 1, 'A', '84', false),    ( 42,  4, 2, 'B', '39', true ),
  ( 43,  4, 3, 'C', '54', false),    ( 44,  4, 4, 'D', '29', false),
  -- Q5
  ( 51,  5, 1, 'A', '5',   true ),   ( 52,  5, 2, 'B', '−5', false),
  ( 53,  5, 3, 'C', '19',  false),   ( 54,  5, 4, 'D', '−19', false),
  -- Q6
  ( 61,  6, 1, 'A', '4',  false),    ( 62,  6, 2, 'B', '12', true ),
  ( 63,  6, 3, 'C', '6',  false),    ( 64,  6, 4, 'D', '72', false),
  -- Q7
  ( 71,  7, 1, 'A', '45/100',  false), ( 72,  7, 2, 'B', '9/200', true ),
  ( 73,  7, 3, 'C', '9/20',    false), ( 74,  7, 4, 'D', '45/1000', false),
  -- Q8
  ( 81,  8, 1, 'A', '2/6', false),   ( 82,  8, 2, 'B', '1/6', false),
  ( 83,  8, 3, 'C', '3/4', true ),   ( 84,  8, 4, 'D', '1/8', false),
  -- Q9
  ( 91,  9, 1, 'A', '1/6', false),   ( 92,  9, 2, 'B', '5/3', false),
  ( 93,  9, 3, 'C', '3/5', true ),   ( 94,  9, 4, 'D', '6/5', false),
  -- Q10
  (101, 10, 1, 'A', '40', false),    (102, 10, 2, 'B', '60', true ),
  (103, 10, 3, 'C', '80', false),    (104, 10, 4, 'D', '96', false),
  -- Q11
  (111, 11, 1, 'A', '6',  true ),    (112, 11, 2, 'B', '3', false),
  (113, 11, 3, 'C', '5',  false),    (114, 11, 4, 'D', '30', false),
  -- Q12
  (121, 12, 1, 'A', '88', false),    (122, 12, 2, 'B', '90', false),
  (123, 12, 3, 'C', '92', true ),    (124, 12, 4, 'D', '95', false),
  -- Q13
  (131, 13, 1, 'A', '1/2',  false),  (132, 13, 2, 'B', '8/27', false),
  (133, 13, 3, 'C', '3/2',  true ),  (134, 13, 4, 'D', '2/3', false),
  -- Q14
  (141, 14, 1, 'A', '£56.25', false), (142, 14, 2, 'B', '£60', true ),
  (143, 14, 3, 'C', '£65',    false), (144, 14, 4, 'D', '£70', false),
  -- Q15
  (151, 15, 1, 'A', '8a',  true ),   (152, 15, 2, 'B', '15a', false),
  (153, 15, 3, 'C', '8a²', false),   (154, 15, 4, 'D', '2a', false),
  -- Q16
  (161, 16, 1, 'A', '22', false),    (162, 16, 2, 'B', '8', true ),
  (163, 16, 3, 'C', '7',  false),    (164, 16, 4, 'D', '2', false),
  -- Q17
  (171, 17, 1, 'A', '5.5', false),   (172, 17, 2, 'B', '6', false),
  (173, 17, 3, 'C', '8',   true ),   (174, 17, 4, 'D', '11', false),
  -- Q18
  (181, 18, 1, 'A', '6x + 4',  false), (182, 18, 2, 'B', '6x + 12', true ),
  (183, 18, 3, 'C', '5x + 12', false), (184, 18, 4, 'D', '6x + 7', false),
  -- Q19
  (191, 19, 1, 'A', '3',  false),    (192, 19, 2, 'B', '5', true ),
  (193, 19, 3, 'C', '7',  false),    (194, 19, 4, 'D', '15', false),
  -- Q20
  (201, 20, 1, 'A', '35',  false),   (202, 20, 2, 'B', '47', true ),
  (203, 20, 3, 'C', '143', false),   (204, 20, 4, 'D', '23', false),
  -- Q21
  (211, 21, 1, 'A', '(x + 2)(x + 6)',  false), (212, 21, 2, 'B', '(x + 3)(x + 4)', true ),
  (213, 21, 3, 'C', '(x + 1)(x + 12)', false), (214, 21, 4, 'D', '(x + 7)(x + 12)', false),
  -- Q22
  (221, 22, 1, 'A', '90°',  false),  (222, 22, 2, 'B', '180°', true ),
  (223, 22, 3, 'C', '270°', false),  (224, 22, 4, 'D', '360°', false),
  -- Q23
  (231, 23, 1, 'A', '13 cm²', false), (232, 23, 2, 'B', '26 cm²', false),
  (233, 23, 3, 'C', '40 cm²', true ), (234, 23, 4, 'D', '80 cm²', false),
  -- Q24
  (241, 24, 1, 'A', '67°',  true ),  (242, 24, 2, 'B', '77°', false),
  (243, 24, 3, 'C', '113°', false),  (244, 24, 4, 'D', '47°', false),
  -- Q25
  (251, 25, 1, 'A', '15.7 cm', false), (252, 25, 2, 'B', '31.4 cm', true ),
  (253, 25, 3, 'C', '78.5 cm', false), (254, 25, 4, 'D', '25 cm', false),
  -- Q26
  (261, 26, 1, 'A', '42 cm²', true ), (262, 26, 2, 'B', '84 cm²', false),
  (263, 26, 3, 'C', '19 cm²', false), (264, 26, 4, 'D', '21 cm²', false),
  -- Q27
  (271, 27, 1, 'A', '12 cm³',  false), (272, 27, 2, 'B', '47 cm³', false),
  (273, 27, 3, 'C', '60 cm³',  true ), (274, 27, 4, 'D', '120 cm³', false),
  -- Q28
  (281, 28, 1, 'A', '1/6', true ),   (282, 28, 2, 'B', '1/4', false),
  (283, 28, 3, 'C', '4/6', false),   (284, 28, 4, 'D', '1/2', false),
  -- Q29
  (291, 29, 1, 'A', '6',  false),    (292, 29, 2, 'B', '7', true ),
  (293, 29, 3, 'C', '8',  false),    (294, 29, 4, 'D', '28', false),
  -- Q30
  (301, 30, 1, 'A', '4',   false),   (302, 30, 2, 'B', '7', true ),
  (303, 30, 3, 'C', '9',   false),   (304, 30, 4, 'D', '6.8', false),
  -- Q31
  (311, 31, 1, 'A', '1/2', false),   (312, 31, 2, 'B', '1/3', false),
  (313, 31, 3, 'C', '1/4', true ),   (314, 31, 4, 'D', '1/8', false),
  -- Q32
  (321, 32, 1, 'A', '7',  false),    (322, 32, 2, 'B', '12', false),
  (323, 32, 3, 'C', '14', true ),    (324, 32, 4, 'D', '19', false);

-- NOTE: the Postgres version of this file ended with a PL/pgSQL block asserting that
-- every question has exactly 4 options with exactly 1 correct answer. SQLite has no
-- procedural language, and the "at most one correct" half is already enforced by
-- answer_options_one_correct_idx above. Both halves are asserted in
-- SchemaMigrationTest, which runs these real migrations against a temp database -
-- a better place for the check anyway, since it reports in CI rather than crashing
-- the app at boot.
