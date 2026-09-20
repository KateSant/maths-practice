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
      selectedLabel: 'B',
      selectedText: '3/4',
      correct: true,
      correctLabel: 'B',
      correctText: '3/4',
      explanation: 'A half is two quarters, so two quarters plus one quarter makes three quarters.',
    },
    {
      questionId: 2,
      prompt: 'Which fraction is equivalent to 0.6?',
      selectedLabel: 'C',
      selectedText: '3/5',
      correct: true,
      correctLabel: 'C',
      correctText: '3/5',
      explanation: '0.6 is six tenths, and dividing top and bottom by two gives three fifths.',
    },
    {
      questionId: 3,
      prompt: 'What is 2/3 × 3/4?',
      selectedLabel: 'A',
      selectedText: '6/7',
      correct: false,
      correctLabel: 'D',
      correctText: '1/2',
      explanation: 'Multiply across the top and the bottom: 2×3 over 3×4 is 6/12, which cancels to 1/2.',
    },
    {
      questionId: 4,
      prompt: 'Which is larger: 5/8 or 3/5?',
      selectedLabel: 'B',
      selectedText: '3/5',
      correct: false,
      correctLabel: 'A',
      correctText: '5/8',
      explanation: 'Over a common denominator of 40 they are 25/40 and 24/40, so 5/8 is just ahead.',
    },
    {
      questionId: 5,
      prompt: 'What is 3 ÷ 1/4?',
      selectedLabel: 'D',
      selectedText: '12',
      correct: true,
      correctLabel: 'D',
      correctText: '12',
      explanation: 'Dividing by a quarter is the same as multiplying by four.',
    },
  ],
}

export function DevResultsPage() {
  return <ResultsPage previewSummary={DEMO_SUMMARY} />
}
