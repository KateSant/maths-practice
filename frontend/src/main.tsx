import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { APP_TITLE } from './lib/branding'
import './index.css'

// Set from the constant rather than hard-coded in index.html, so the tab follows along if the
// wording changes. index.html keeps the same string as a fallback for the instant before this
// runs.
document.title = APP_TITLE

const container = document.getElementById('root')
if (!container) {
  throw new Error('Could not find #root to mount the app into')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
