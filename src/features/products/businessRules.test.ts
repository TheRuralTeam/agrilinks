import { describe, it, expect } from 'vitest'
import { validateProductSubmission, validatePreOrderSubmission } from './businessRules'

describe('product and order business rules', () => {
  it('accepts a valid product submission', () => {
    const result = validateProductSubmission({
      product_type: 'Milho',
      quantity: 500,
      harvest_date: '2030-06-15',
      price: 1800,
      province_id: 'luanda',
      municipality_id: 'kilamba',
      logistics_access: 'sim',
      photos: ['a.jpg', 'b.jpg', 'c.jpg'],
      category: 'grãos',
    })

    expect(result.valid).toBe(true)
  })

  it('rejects product publication with invalid quantities or stale harvest date', () => {
    expect(() =>
      validateProductSubmission({
        product_type: 'Milho',
        quantity: 0,
        harvest_date: '2026-09-05',
        price: 1800,
        province_id: 'luanda',
        municipality_id: 'kilamba',
        logistics_access: 'sim',
        photos: ['a.jpg', 'b.jpg', 'c.jpg'],
        category: 'grãos',
      }),
    ).toThrow(/maior que zero|30 dias|colheita/i)
  })

  it('rejects a pre-order when the product is not active or quantity exceeds stock', () => {
    expect(() =>
      validatePreOrderSubmission({
        product: { id: 'p1', status: 'inactive', quantity: 50, user_id: 'seller-1', price: 1200 },
        buyer_id: 'buyer-1',
        quantity: 60,
        location: 'Talatona',
      }),
    ).toThrow(/não disponível|maior que o stock/i)
  })

  it('rejects a buyer from ordering their own product', () => {
    expect(() =>
      validatePreOrderSubmission({
        product: { id: 'p1', status: 'active', quantity: 50, user_id: 'same-user', price: 1200 },
        buyer_id: 'same-user',
        quantity: 10,
        location: 'Talatona',
      }),
    ).toThrow(/próprio|não pode/i)
  })
})
