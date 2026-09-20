import type { SessionSummary } from '../api/types'
import { ResultsPage } from './ResultsPage'

/**
 * Development-only preview of the results page, so the layout (in particular the mining
 * reward) can be seen without sitting a quiz first.
 *
 * Reached at /dev/results while running `npm run dev`; the route is not registered in a
 * production build. Change DEMO_SCORE to preview other outcomes - 5 is a perfect score,
 * which swaps the gold ore for diamond.
 */

const DEMO_SCORE = 4
const DEMO_QUESTIONS = 5

const DEMO_SUMMARY: SessionSummary = {
  sessionId: 0,
  topicSlug: 'fractions',
  topicName: 'Fractions',
  questionCount: DEMO_QUESTIONS,
  answeredCount: DEMO_QUESTIONS,
  correctCount: DEMO_SCORE,
  pointsAwarded: DEMO_SCORE * 10,
  accuracyPercent: Math.round((DEMO_SCORE / DEMO_QUESTIONS) * 100),
  startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  completedAt: new Date().toISOString(),
  // Four of five: two of these plus a bonus short of a clean sweep.
  playSecondsEarned: 4 * 20,
  // Aimed at level 3 and now headed for 4, so the preview shows the "moving up" case.
  setLevel: 3,
  level: 4,
  review: [
    {
      questionId: 1,
      prompt: 'What is 1/2 + 1/4?',
      answerType: 'SINGLE_CHOICE',
      selectedOptions: [{ label: 'B', text: '3/4' }],
      correct: true,
      correctOptions: [{ label: 'B', text: '3/4' }],
      explanation: 'A half is two quarters, so two quarters plus one quarter makes three quarters.',
    },
    {
      questionId: 2,
      prompt: 'Which fraction is equivalent to 0.6?',
      answerType: 'SINGLE_CHOICE',
      selectedOptions: [{ label: 'C', text: '3/5' }],
      correct: true,
      correctOptions: [{ label: 'C', text: '3/5' }],
      explanation: '0.6 is six tenths, and dividing top and bottom by two gives three fifths.',
    },
    {
      questionId: 3,
      prompt: 'What is 2/3 × 3/4?',
      answerType: 'SINGLE_CHOICE',
      selectedOptions: [{ label: 'A', text: '6/7' }],
      correct: false,
      correctOptions: [{ label: 'D', text: '1/2' }],
      explanation: 'Multiply across the top and the bottom: 2×3 over 3×4 is 6/12, which cancels to 1/2.',
    },
    // The tick-all case, including a partly-right answer: one of the two correct options was
    // ticked, so the review shows the tick that landed and the one that was missed.
    {
      questionId: 4,
      prompt: 'Tick every fraction that is greater than 1/2.',
      answerType: 'MULTI_SELECT',
      selectedOptions: [{ label: 'B', text: '3/5' }],
      correct: false,
      correctOptions: [
        { label: 'A', text: '5/8' },
        { label: 'B', text: '3/5' },
      ],
      explanation:
        'Over a denominator of 40, 5/8 is 25/40 and 3/5 is 24/40. Both beat 20/40, so both apply. ' +
        '2/5 is 16/40 and 3/8 is 15/40, so neither does.',
    },
    {
      questionId: 5,
      prompt: 'What is 3 ÷ 1/4?',
      answerType: 'SINGLE_CHOICE',
      selectedOptions: [{ label: 'D', text: '12' }],
      correct: true,
      correctOptions: [{ label: 'D', text: '12' }],
      explanation: 'Dividing by a quarter is the same as multiplying by four.',
    },
  ],
}

export function DevResultsPage() {
  return <ResultsPage previewSummary={DEMO_SUMMARY} />
}
