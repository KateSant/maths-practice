import { describe, expect, it } from 'vitest'
import { allowsGuest, landingFor, parseRole, SIGN_IN_ROLES } from './roles'

describe('the sign-in role choice', () => {
  it('offers exactly two roles', () => {
    expect(SIGN_IN_ROLES.map((option) => option.value)).toEqual(['student', 'teacher'])
  })

  it('sends a teacher to the question bank, because that is what they asked for', () => {
    expect(landingFor('teacher')).toBe('/admin/questions')
  })

  it('sends a student to practice', () => {
    expect(landingFor('student')).toBe('/')
  })

  it('reads a role from the URL', () => {
    expect(parseRole('student')).toBe('student')
    expect(parseRole('teacher')).toBe('teacher')
  })

  it('refuses anything else, rather than defaulting to a role', () => {
    // A missing or invented segment must not silently become "student" - that would put someone
    // on a page claiming a choice they never made.
    expect(parseRole(undefined)).toBeNull()
    expect(parseRole('')).toBeNull()
    expect(parseRole('admin')).toBeNull()
    expect(parseRole('Teacher')).toBeNull()
  })

  it('only offers guest sign-in to students', () => {
    // A guest has no Google identity, so it can never be granted teacher access. Offering it on
    // the teacher page would be a dead end.
    expect(allowsGuest('student')).toBe(true)
    expect(allowsGuest('teacher')).toBe(false)
  })
})
