import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}))

import { fetchActiveProducts } from './productsService'

describe('productsService', () => {
  beforeEach(() => {
    mockSupabaseFrom.mockReset()
  })

  it('returns a professional public fallback when there are no active products in the database', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }
    })

    const products = await fetchActiveProducts()

    expect(products.length).toBeGreaterThan(0)
    expect(products[0]).toMatchObject({
      product_type: expect.any(String),
      price: expect.any(Number),
      status: 'active',
      farmer_name: expect.any(String),
    })
  })
})
