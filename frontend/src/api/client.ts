import { readToken } from '../auth/session'
import type {
  AnswerResult,
  ApiError,
  AuthResponse,
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
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
  register: (email: string, password: string, displayName: string) =>
    apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    }),

  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

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
}
