import { supabase } from '../../integrations/supabase/client'
import type { AdminPreOrderStatus } from './adminPreOrderStatus'

export async function setAdminPreOrderStatus(orderId: string, status: AdminPreOrderStatus) {
  const { data, error } = await supabase.rpc('admin_update_pre_order_status', {
    p_order_id: orderId,
    p_status: status,
  })

  if (error) throw error

  const updatedOrder = data?.[0]
  if (!updatedOrder) throw new Error('O servidor não confirmou a alteração do pedido.')

  return updatedOrder
}

export async function respondToPreOrder(orderId: string, status: 'accepted' | 'rejected') {
  const { data, error } = await supabase.rpc('respond_to_pre_order', {
    p_order_id: orderId,
    p_status: status,
  })

  if (error) throw error

  const updatedOrder = data?.[0]
  if (!updatedOrder) throw new Error('O servidor não confirmou a resposta ao pedido.')

  return updatedOrder
}