import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './theme/ThemeContext'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Could not find #root to mount the app into')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      {/* Outside AuthProvider: the theme is a local preference and should apply on the
          sign-in screen too, before anyone is authenticated. */}
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
