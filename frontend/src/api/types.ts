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

export interface Question {
  id: number
  prompt: string
  difficulty: number
  options: AnswerOption[]
}

export interface QuizSession {
  sessionId: number
  topicSlug?: string
  topicName: string
  questionCount: number
  startedAt: string
  questions: Question[]
}

export interface AnswerResult {
  questionId: number
  correct: boolean
  correctOptionId: number
  explanation?: string
  pointsAwarded: number
  totalPoints: number
  currentStreak: number
  bestStreak: number
  answeredSoFar: number
  correctSoFar: number
}

export interface QuestionReview {
  questionId: number
  prompt: string
  selectedLabel?: string
  selectedText?: string
  correct: boolean
  correctLabel?: string
  correctText?: string
  explanation?: string
}

export interface SessionSummary {
  sessionId: number
  topicSlug?: string
  topicName: string
  questionCount: number
  answeredCount: number
  correctCount: number
  pointsAwarded: number
  accuracyPercent: number
  startedAt: string
  completedAt?: string
  review: QuestionReview[]
}

export interface TopicStats {
  topicId: number
  topicName: string
  answered: number
  correct: number
  accuracyPercent: number
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
