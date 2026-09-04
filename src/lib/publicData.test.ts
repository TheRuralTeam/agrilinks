import { describe, expect, it } from 'vitest'
import { sanitizePublicProfile, sanitizePublicProduct, isNeutralPublicView } from './publicData'

describe('publicData', () => {
  it('removes private profile fields in public view', () => {
    const profile = {
      id: 'user-1',
      full_name: 'Maria Silva',
      email: 'maria@agrilink.ao',
      phone: '+244 912 000 000',
      address: 'Rua A',
      avatar_url: 'https://example.com/avatar.png',
      province_id: 'Luanda',
      municipality_id: 'Viana',
    }

    const safe = sanitizePublicProfile(profile)
    expect(safe.full_name).toBe('Maria Silva')
    expect(safe.email).toBeUndefined()
    expect(safe.phone).toBeUndefined()
    expect(safe.address).toBeUndefined()
    expect(safe.id).toBeUndefined()
  })

  it('keeps only real public product information', () => {
    const product = {
      id: 'p-1',
      user_id: 'user-1',
      product_type: 'Manga',
      quantity: 250,
      price: 1200,
      status: 'active',
      farmer_name: 'Produtor Local',
      photos: ['https://example.com/1.jpg'],
      location: 'Luanda',
    }

    const safe = sanitizePublicProduct(product)
    expect(safe.product_type).toBe('Manga')
    expect(safe.user_id).toBeUndefined()
    expect(safe.farmer_name).toBe('Produtor Local')
    expect(safe.location).toBe('Luanda')
  })

  it('detects the neutral/public mode when there is no authenticated user', () => {
    expect(isNeutralPublicView(undefined)).toBe(true)
    expect(isNeutralPublicView({ id: 'u-1' })).toBe(false)
  })
})
