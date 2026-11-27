import { describe, it, expect } from 'vitest'
import { validateProductSubmission, validatePreOrderSubmission } from './businessRules'

const validProduct = {
  product_type: 'Milho',
  quantity: 1000,
  harvest_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
  price: 500000,
  sale_unit: 'kg' as const,
  min_order_quantity: 1,
  province_id: 'luanda',
  municipality_id: 'viana',
  logistics_access: 'sim' as const,
  photos: ['a.jpg', 'b.jpg', 'c.jpg'],
  category: 'Cereais',
}

describe('AgriLink business rules — publication', () => {
  it('accepts a valid product and valid Angola province/municipality pair', () => {
    expect(validateProductSubmission(validProduct)).toEqual({ valid: true })
  })

  it('rejects a municipality that does not belong to the selected province', () => {
    expect(() =>
      validateProductSubmission({
        ...validProduct,
        province_id: 'luanda',
        municipality_id: 'huambo',
      }),
    ).toThrow('não pertence à província')
  })

  it('requires at least three product photos', () => {
    expect(() =>
      validateProductSubmission({
        ...validProduct,
        photos: ['a.jpg', 'b.jpg'],
      }),
    ).toThrow('pelo menos 3 imagens')
  })
})

describe('AgriLink business rules — pre-order', () => {
  const product = {
    id: 'product-1',
    status: 'active',
    quantity: 100,
    user_id: 'farmer-1',
    price: 5000,
    sale_unit: 'kg',
    min_order_quantity: 5,
  }

  it('calculates the order total from the product price and requested quantity', () => {
    expect(
      validatePreOrderSubmission({
        product,
        buyer_id: 'buyer-1',
        quantity: 10,
        location: 'Viana',
      }),
    ).toEqual({ valid: true, total_price: 50000 })
  })

  it('rejects a quantity below the listing minimum', () => {
    expect(() => validatePreOrderSubmission({ product, buyer_id: 'buyer-1', quantity: 2, location: 'Viana' })).toThrow('quantidade mínima')
  })

  it('rejects buying your own product', () => {
    expect(() =>
      validatePreOrderSubmission({
        product,
        buyer_id: 'farmer-1',
        quantity: 10,
        location: 'Viana',
      }),
    ).toThrow('próprio produto')
  })

  it('rejects quantities above available stock', () => {
    expect(() =>
      validatePreOrderSubmission({
        product,
        buyer_id: 'buyer-1',
        quantity: 101,
        location: 'Viana',
      }),
    ).toThrow('stock disponível')
  })
})
