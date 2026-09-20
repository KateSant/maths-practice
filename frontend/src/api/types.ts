/** Mirrors the backend DTOs. Kept hand-written: it is small, and it keeps the
 *  contract visible rather than hidden behind code generation. */

export interface User {
  id: number
  email: string
  displayName: string
  role: string
  points: number
  currentStreak: number
  bestStreak: number
  /** Unspent seconds of reward-game time. */
  playSeconds: number
  createdAt: string
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: User
}

export interface Topic {
  id: number
  slug: string
  name: string
  description?: string
  questionCount: number
}

export interface AnswerOption {
  id: number
  label: string
  text: string
}

/**
 * How a question is answered, and therefore how it is graded.
 *
 * The server sends this because the screen cannot otherwise tell a tick-all question from a single
 * choice. It says how to answer, never what the answer is - the key stays on the server until the
 * answer has been submitted.
 */
export type AnswerType = 'SINGLE_CHOICE' | 'MULTI_SELECT'

export interface Question {
  id: number
  prompt: string
  difficulty: number
  /** The school year this question is filed in, 7 to 13. */
  yearGroup: number
  answerType: AnswerType
  options: AnswerOption[]
}

export interface QuizSession {
  sessionId: number
  topicSlug?: string
  topicName: string
  questionCount: number
  /** The year group this set was drawn from, or undefined when it was mixed across years. */
  yearGroup?: number
  startedAt: string
  questions: Question[]
}

export interface AnswerResult {
  questionId: number
  answerType: AnswerType
  correct: boolean
  /** The whole key. One entry for a single choice, several for a tick-all. */
  correctOptionIds: number[]
  explanation?: string
  pointsAwarded: number
  totalPoints: number
  currentStreak: number
  bestStreak: number
  answeredSoFar: number
  correctSoFar: number
}

/** One option as the review shows it. */
export interface ReviewOption {
  label: string
  text: string
}

export interface QuestionReview {
  questionId: number
  prompt: string
  answerType: AnswerType
  /** Empty when the question was never answered, which the review says in words. */
  selectedOptions: ReviewOption[]
  correct: boolean
  correctOptions: ReviewOption[]
  explanation?: string
}

export interface SessionSummary {
  sessionId: number
  topicSlug?: string
  topicName: string
  /** The year group this set was dealt from, or undefined when mixed or unrecorded. */
  yearGroup?: number
  questionCount: number
  answeredCount: number
  correctCount: number
  pointsAwarded: number
  accuracyPercent: number
  startedAt: string
  completedAt?: string
  /** The level the next set in this topic will be aimed at, given how this one went. */
  level: number
  /** The level this set was aimed at, so the two can be compared. */
  setLevel: number
  /** Seconds of reward-game time this score was worth. */
  playSecondsEarned: number
  review: QuestionReview[]
}

/** Where a student's play time stands, plus the rates that earned it. */
export interface GameStatus {
  secondsRemaining: number
  secondsPerCorrectAnswer: number
  perfectBonusSeconds: number
  maxSessionSeconds: number
}

export interface TopicStats {
  topicId: number
  topicName: string
  answered: number
  correct: number
  accuracyPercent: number
  /** The level the next set in this topic will be aimed at, 1-5. */
  level: number
}

export interface Stats {
  totalAnswered: number
  totalCorrect: number
  accuracyPercent: number
  sessionsCompleted: number
  byTopic: TopicStats[]
}

export interface Profile {
  user: User
  stats: Stats
}

export interface HistoryItem {
  sessionId: number
  topicName: string
  questionCount: number
  correctCount: number
  pointsAwarded: number
  accuracyPercent: number
  completedAt: string
}

/** The shape GlobalExceptionHandler returns for every failure. */
export interface ApiError {
  timestamp: string
  status: number
  message: string
  fieldErrors?: Record<string, string>
}
