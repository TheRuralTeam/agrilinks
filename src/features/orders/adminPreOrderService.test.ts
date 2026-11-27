import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../integrations/supabase/client'
import { respondToPreOrder, setAdminPreOrderStatus } from './adminPreOrderService'

vi.mock('../../integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}))

const rpc = vi.mocked(supabase.rpc)

describe('setAdminPreOrderStatus', () => {
  beforeEach(() => rpc.mockReset())

  it('persists the selected workflow status with the order id', async () => {
    const persistedOrder = { id: 'pre-order-1', status: 'accepted', updated_at: '2026-09-28T12:00:00Z' }
    rpc.mockResolvedValue({ data: [persistedOrder], error: null } as never)

    await expect(setAdminPreOrderStatus('pre-order-1', 'accepted')).resolves.toEqual(persistedOrder)
    expect(rpc).toHaveBeenCalledWith('admin_update_pre_order_status', {
      p_order_id: 'pre-order-1',
      p_status: 'accepted',
    })
  })

  it('propagates backend authorization or persistence errors', async () => {
    const backendError = new Error('Permission denied to manage orders')
    rpc.mockResolvedValue({ data: null, error: backendError } as never)

    await expect(setAdminPreOrderStatus('pre-order-1', 'rejected')).rejects.toBe(backendError)
  })

  it('does not treat an empty backend response as success', async () => {
    rpc.mockResolvedValue({ data: [], error: null } as never)

    await expect(setAdminPreOrderStatus('missing-order', 'pending'))
      .rejects.toThrow('O servidor não confirmou a alteração do pedido.')
  })

  it('persists producer responses using the dedicated backend action', async () => {
    const persistedOrder = { id: 'pre-order-2', status: 'rejected', updated_at: '2026-09-28T12:00:00Z' }
    rpc.mockResolvedValue({ data: [persistedOrder], error: null } as never)

    await expect(respondToPreOrder('pre-order-2', 'rejected')).resolves.toEqual(persistedOrder)
    expect(rpc).toHaveBeenCalledWith('respond_to_pre_order', {
      p_order_id: 'pre-order-2',
      p_status: 'rejected',
    })
  })
})