import type { AnswerType } from './types'
import { apiRequest } from './client'

/**
 * The admin API, and its types.
 *
 * Deliberately a separate module rather than additions to `types.ts` and `api` alongside the
 * student endpoints. These responses carry **the answer key** — `AdminOption.correct` — and the
 * backend keeps them in their own package for exactly that reason. Mirroring that split here
 * makes the boundary visible on this side too, and removes the temptation to reuse a
 * student-facing type for the editor.
 *
 * `/api/admin/**` is refused with 403 for anybody without the ADMIN role, so a student who
 * somehow reached these screens would get errors rather than content.
 */
export type QuestionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED'
export type QuestionOrigin = 'SEED' | 'AUTHORED' | 'IMPORTED'

export interface AdminOption {
  id: number
  label: string
  text: string
  correct: boolean
}

export interface AdminQuestionSummary {
  id: number
  prompt: string
  topicId: number
  topicName: string
  difficulty: number
  yearGroup: number
  answerType: AnswerType
  status: QuestionStatus
  origin: QuestionOrigin
  createdAt: string
}

export interface AdminQuestionDetail {
  id: number
  topicId: number
  topicName: string
  prompt: string
  explanation?: string
  difficulty: number
  yearGroup: number
  answerType: AnswerType
  status: QuestionStatus
  origin: QuestionOrigin
  createdAt: string
  options: AdminOption[]
}

/** Mirrors PageResponse on the server, rather than Spring's own Page serialisation. */
export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface QuestionOptionDraft {
  text: string
  correct: boolean
}

export interface SaveQuestionRequest {
  topicId: number
  prompt: string
  explanation?: string | null
  difficulty: number
  /** The year group this question belongs to, 7 to 13. */
  yearGroup: number
  answerType: AnswerType
  options: QuestionOptionDraft[]
}

export interface AdminTopic {
  id: number
  slug: string
  name: string
  description?: string
  sortOrder: number
}

/** How many published questions a topic holds in each band. */
export interface BandCount {
  band: number
  questions: number
}

export interface TopicCoverage {
  topicId: number
  topicName: string
  bands: BandCount[]
  published: number
  canFillASet: boolean
}

export interface SaveTopicRequest {
  slug: string
  name: string
  description?: string | null
  sortOrder: number
}

export interface QuestionFilters {
  topicId?: number
  status?: QuestionStatus
  difficulty?: number
  origin?: QuestionOrigin
  yearGroup?: number
  q?: string
  page?: number
  size?: number
}

/** Omits empty values, so a cleared filter means "no filter" rather than "match nothing". */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  const rendered = search.toString()
  return rendered ? `?${rendered}` : ''
}

export const adminApi = {
  questions: (filters: QuestionFilters) =>
    apiRequest<PageResponse<AdminQuestionSummary>>(
      `/admin/questions${query({
        topicId: filters.topicId,
        status: filters.status,
        difficulty: filters.difficulty,
        origin: filters.origin,
        yearGroup: filters.yearGroup,
        q: filters.q,
        page: filters.page,
        size: filters.size,
      })}`,
    ),

  question: (id: number) => apiRequest<AdminQuestionDetail>(`/admin/questions/${id}`),

  createQuestion: (body: SaveQuestionRequest) =>
    apiRequest<AdminQuestionDetail>('/admin/questions', { method: 'POST', body }),

  updateQuestion: (id: number, body: SaveQuestionRequest) =>
    apiRequest<AdminQuestionDetail>(`/admin/questions/${id}`, { method: 'PUT', body }),

  publishQuestion: (id: number) =>
    apiRequest<AdminQuestionDetail>(`/admin/questions/${id}/publish`, { method: 'POST' }),

  retireQuestion: (id: number) =>
    apiRequest<AdminQuestionDetail>(`/admin/questions/${id}/retire`, { method: 'POST' }),

  topics: () => apiRequest<AdminTopic[]>('/admin/topics'),

  /** Published questions per topic per band, for the coverage panel on the Topics screen. */
  coverage: () => apiRequest<TopicCoverage[]>('/admin/coverage'),

  createTopic: (body: SaveTopicRequest) => apiRequest<AdminTopic>('/admin/topics', { method: 'POST', body }),

  updateTopic: (id: number, body: SaveTopicRequest) =>
    apiRequest<AdminTopic>(`/admin/topics/${id}`, { method: 'PUT', body }),
}
