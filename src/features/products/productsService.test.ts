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

  it('returns an empty public feed when there are no active products in the database', async () => {
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

    expect(products).toEqual([])
  })
})
