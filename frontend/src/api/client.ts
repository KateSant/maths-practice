import { readToken } from '../auth/session'
import type {
  AnswerResult,
  ApiError,
  AuthResponse,
  GameStatus,
  HistoryItem,
  Profile,
  QuizSession,
  SessionSummary,
  Topic,
} from './types'

/** Relative by default: the Vite dev proxy and Caddy both serve the API from the
 *  same origin, so there is no CORS anywhere. Override with VITE_API_URL if the
 *  API ever lives somewhere else. */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export class ApiRequestError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/** Registered by the auth provider so an expired token logs the user out cleanly. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

/**
 * Exported so the admin API in `api/admin.ts` can reuse the token handling, error mapping and
 * 401 hook rather than growing a second copy of them.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken()
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiRequestError(0, 'Could not reach the server. Is the API running?')
  }

  if (response.status === 401) {
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    const { message, fieldErrors } = await readError(response)
    throw new ApiRequestError(response.status, message, fieldErrors)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

async function readError(response: Response): Promise<{ message: string; fieldErrors: Record<string, string> }> {
  try {
    const body = (await response.json()) as ApiError
    return {
      message: body.message || `Request failed (${response.status})`,
      fieldErrors: body.fieldErrors ?? {},
    }
  } catch {
    return { message: `Request failed (${response.status})`, fieldErrors: {} }
  }
}

export const api = {
  /**
   * Exchanges the Google ID token the browser received for one of our own JWTs. The
   * ID token is never stored — only the token we get back.
   */
  signInWithGoogle: (idToken: string) =>
    apiRequest<AuthResponse>('/auth/google', { method: 'POST', body: { idToken } }),

  continueAsGuest: () => apiRequest<AuthResponse>('/auth/guest', { method: 'POST' }),

  profile: () => apiRequest<Profile>('/me'),

  updateDisplayName: (displayName: string) =>
    apiRequest<Profile>('/me', { method: 'PATCH', body: { displayName } }),

  history: () => apiRequest<HistoryItem[]>('/me/history'),

  topics: () => apiRequest<Topic[]>('/topics'),

  startQuiz: (topicSlug: string | null, count: number) =>
    apiRequest<QuizSession>('/quiz/sessions', {
      method: 'POST',
      body: { topicSlug, count },
    }),

  submitAnswer: (sessionId: number, questionId: number, optionId: number, timeMs: number) =>
    apiRequest<AnswerResult>(`/quiz/sessions/${sessionId}/answers`, {
      method: 'POST',
      body: { questionId, optionId, timeMs },
    }),

  completeQuiz: (sessionId: number) =>
    apiRequest<SessionSummary>(`/quiz/sessions/${sessionId}/complete`, { method: 'POST' }),

  session: (sessionId: number) => apiRequest<SessionSummary>(`/quiz/sessions/${sessionId}`),

  /** The play-time balance, without spending any of it. */
  gameStatus: () => apiRequest<GameStatus>('/game'),

  /**
   * "Still playing." The client never says how long it has played - the server bills the
   * wall-clock time since the previous call - so this can be sent as often as the countdown
   * needs refreshing without the student being able to mint time by lying.
   */
  gameHeartbeat: () => apiRequest<GameStatus>('/game/heartbeat', { method: 'POST' }),
}
