import { describe, expect, it } from 'vitest'
import { canAccessVisitorProfile, requiresLoginForAction } from './accessPolicy'

describe('access policy', () => {
  it('keeps public profile viewing available without an authenticated session', () => {
    expect(canAccessVisitorProfile(null)).toBe(true)
    expect(canAccessVisitorProfile(undefined)).toBe(true)
  })

  it('requires login for purchase, like, comment and similar user actions', () => {
    expect(requiresLoginForAction('purchase')).toBe(true)
    expect(requiresLoginForAction('like')).toBe(true)
    expect(requiresLoginForAction('comment')).toBe(true)
    expect(requiresLoginForAction('browse')).toBe(false)
  })
})
