/**
 * Google Identity Services.
 *
 * Loaded dynamically rather than through a <script> tag in index.html, for two
 * reasons: a blocked or failed load (ad blocker, offline, corporate proxy) becomes a
 * catchable error we can put on screen instead of an empty box, and tests do not need
 * the real Google library to be present.
 */
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export interface GoogleCredentialResponse {
  credential: string
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }
}

/**
 * The OAuth client ID, inlined by Vite at build time. Public by design: it ships in
 * the bundle and appears in every consent request. It is *not* available at runtime,
 * so setting it as a container environment variable does nothing — see
 * docs/google-signin.md.
 */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export const isGoogleConfigured = GOOGLE_CLIENT_ID.length > 0

/** Thrown when the library cannot be loaded, so the page can say something useful. */
export class GoogleScriptError extends Error {}

let pending: Promise<GoogleIdentityServices> | null = null

export function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google)
  }
  if (pending) {
    return pending
  }

  pending = new Promise<GoogleIdentityServices>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google)
      } else {
        reject(new GoogleScriptError('Google sign-in loaded but did not start.'))
      }
    }
    script.onerror = () => {
      reject(
        new GoogleScriptError(
          'Could not reach Google sign-in. Check your connection, or any ad blocker, and try again.',
        ),
      )
    }
    document.head.appendChild(script)
  })

  // A failure must not be cached forever: retrying after the network comes back
  // should work without a page reload.
  pending.catch(() => {
    pending = null
  })

  return pending
}

/**
 * Renders Google's own button into `parent`.
 *
 * The explicit button rather than One Tap: One Tap adds FedCM behaviour, browser-side
 * prompt suppression and UI we do not control, which is a poor trade for something we
 * have to demo predictably.
 *
 * Safe to call more than once. React runs effects twice in development StrictMode, and
 * Google's own guidance is to call `initialize` a single time, so the callback is held
 * here and handed to whoever rendered most recently.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (credential: string) => void,
): Promise<void> {
  const google = await loadGoogleIdentityServices()

  credentialHandler = onCredential

  if (!initialized) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => credentialHandler?.(response.credential),
    })
    initialized = true
  }

  // Idempotent: without this a second render would stack a second button.
  parent.replaceChildren()
  google.accounts.id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    // Matches the guest button below it, so the two read as one choice.
    width: 320,
  })
}

let credentialHandler: ((credential: string) => void) | null = null
let initialized = false
