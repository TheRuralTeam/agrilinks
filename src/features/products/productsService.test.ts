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
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          range: async () => ({ data: [], error: null }),
        }
        return builder
      }

      throw new Error(`Unexpected query to ${table} when the product feed is empty`)
    })

    const products = await fetchActiveProducts()

    expect(products).toEqual([])
  })
})
