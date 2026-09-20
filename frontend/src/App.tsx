import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './components/AppLayout'
import { YearGroupProvider } from './components/YearGroupSelect'
import { Spinner } from './components/ui'
import { DevDigPage } from './pages/DevDigPage'
import { DevPlotPage } from './pages/DevPlotPage'
import { DevResultsPage } from './pages/DevResultsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignInPage } from './pages/SignInPage'
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
      {/* Two steps on purpose: choose who is signing in, then sign in as them. The role is in
          the URL, so the second step survives a refresh and the back button works. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/:role" element={<SignInPage />} />

      {/* Dev-only, and deliberately outside the auth guard: the mining reward on its own,
          no session and no sign-in. Dropped entirely from a production build. */}
      {import.meta.env.DEV ? <Route path="/dev/dig" element={<DevDigPage />} /> : null}

      {/* Dev-only, and outside the auth guard for the same reason: a mockup of a drawn answer —
          a coordinate grid to plot points on — shown without a session so it can be looked at
          directly. Nothing here is wired to the API. */}
      {import.meta.env.DEV ? <Route path="/dev/plot" element={<DevPlotPage />} /> : null}

      {/* Everything below shares the app chrome and needs a signed-in user. The year group
          provider wraps the whole layout - including the admin pages nested under it - because the
          header control and the pages it affects are not in the same component. The control itself
          is only rendered on the student side. */}
      <Route
        element={
          <RequireAuth>
            <YearGroupProvider>
              <AppLayout />
            </YearGroupProvider>
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="quiz" element={<QuizPage />} />
        <Route path="results/:sessionId" element={<ResultsPage />} />
        {/* Dev-only: a results page with fixture data, so the layout can be seen without
            answering a quiz first. Dropped entirely from a production build. */}
        {import.meta.env.DEV ? <Route path="dev/results" element={<DevResultsPage />} /> : null}
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
