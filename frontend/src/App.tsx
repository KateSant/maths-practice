import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './components/AppLayout'
import { Spinner } from './components/ui'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { QuizPage } from './pages/QuizPage'
import { ResultsPage } from './pages/ResultsPage'

/**
 * The admin screens are loaded on demand.
 *
 * They are a meaningful amount of code that a student will never open, so bundling them for
 * everyone would slow the app down for the many to serve the one. Written as the `.then` form
 * because the pages use named exports like every other page, and `lazy` needs a default.
 */
const AdminQuestionListPage = lazy(() =>
  import('./pages/admin/AdminQuestionListPage').then((module) => ({ default: module.AdminQuestionListPage })),
)
const AdminQuestionEditorPage = lazy(() =>
  import('./pages/admin/AdminQuestionEditorPage').then((module) => ({ default: module.AdminQuestionEditorPage })),
)
const AdminTopicsPage = lazy(() =>
  import('./pages/admin/AdminTopicsPage').then((module) => ({ default: module.AdminTopicsPage })),
)

/**
 * Belt and braces around every admin route: the role check decides whether to render, and the
 * Suspense boundary covers the chunk still being fetched. The real boundary is the API, which
 * refuses /api/admin/** without the role — this only avoids rendering a page full of errors.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="ADMIN">
      <Suspense fallback={<Spinner label="Loading the admin tools…" />}>{children}</Suspense>
    </RequireRole>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below shares the app chrome and needs a signed-in user. */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="quiz" element={<QuizPage />} />
        <Route path="results/:sessionId" element={<ResultsPage />} />
        <Route path="profile" element={<ProfilePage />} />

        <Route
          path="admin/questions"
          element={
            <AdminRoute>
              <AdminQuestionListPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/questions/new"
          element={
            <AdminRoute>
              <AdminQuestionEditorPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/questions/:id"
          element={
            <AdminRoute>
              <AdminQuestionEditorPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/topics"
          element={
            <AdminRoute>
              <AdminTopicsPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
