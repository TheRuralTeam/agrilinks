import { describe, expect, it } from 'vitest'
import { getProfileDisplayName, getProfileRoleLabel, resolveAvatarUrl } from './profileDisplay'

describe('profileDisplay', () => {
  it('returns the real full name from the database profile', () => {
    expect(getProfileDisplayName({ full_name: 'Maria João', name: 'Empresa X' })).toBe('Maria João')
  })

  it('normalizes role labels to professional names', () => {
    expect(getProfileRoleLabel('comprador')).toBe('Comprador')
    expect(getProfileRoleLabel('agricultor')).toBe('Fornecedor')
    expect(getProfileRoleLabel('agente')).toBe('Agente')
  })

  it('rejects blank or invalid avatar URLs and keeps valid ones', () => {
    expect(resolveAvatarUrl('   ')).toBeNull()
    expect(resolveAvatarUrl('https://cdn.example.com/avatar.png')).toBe('https://cdn.example.com/avatar.png')
    expect(resolveAvatarUrl('javascript:alert(1)')).toBeNull()
  })
})
