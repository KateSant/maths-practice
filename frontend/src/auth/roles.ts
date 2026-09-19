/**
 * The two kinds of person who can sign in, and where each one goes afterwards.
 *
 * Kept apart from the components so the rules are plain functions rather than something buried in
 * JSX — this is the bit worth testing.
 *
 * The role chosen here is a statement of intent, not a permission. It cannot be one: the role
 * lives on the account, and the client is not trusted with it. `landingFor` therefore decides
 * where to *aim* someone, and the API decides what they may actually do.
 */
export type SignInRole = 'student' | 'teacher'

export interface RoleOption {
  value: SignInRole
  label: string
  description: string
}

export const SIGN_IN_ROLES: RoleOption[] = [
  { value: 'student', label: 'Student', description: 'Practise questions and track your progress.' },
  { value: 'teacher', label: 'Teacher', description: 'Write and edit the question bank.' },
]

/**
 * Where each choice leads.
 *
 * A teacher goes to the question bank because that is what choosing Teacher asks for. A student
 * who picks Teacher is not stopped here — they are signed in as a student and simply have no
 * teacher access, and the sign-in page says so rather than bouncing them somewhere unexpected.
 */
export function landingFor(role: SignInRole): string {
  return role === 'teacher' ? '/admin/questions' : '/'
}

/** Turns a URL segment into a role, or null when it is neither. */
export function parseRole(value: string | undefined): SignInRole | null {
  return value === 'student' || value === 'teacher' ? value : null
}

/** Teachers sign in with Google. Guests are students and only students. */
export function allowsGuest(role: SignInRole): boolean {
  return role === 'student'
}
