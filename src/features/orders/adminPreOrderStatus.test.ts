import { describe, expect, it } from 'vitest'
import {
  ADMIN_PRE_ORDER_STATUSES,
  getAdminPreOrderStatusLabel,
  isAdminPreOrderStatusFinal,
} from './adminPreOrderStatus'

describe('admin pre-order statuses', () => {
  it('uses the persisted marketplace statuses', () => {
    expect(ADMIN_PRE_ORDER_STATUSES).toEqual(['pending', 'accepted', 'rejected'])
  })

  it('shows localized labels without mutating the persisted values', () => {
    expect(getAdminPreOrderStatusLabel('pending')).toBe('Pendente')
    expect(getAdminPreOrderStatusLabel('accepted')).toBe('Aceite')
    expect(getAdminPreOrderStatusLabel('rejected')).toBe('Removido')
    expect(getAdminPreOrderStatusLabel('completed')).toBe('Concluído')
    expect(getAdminPreOrderStatusLabel('aguardando')).toBe('Pendente')
  })

  it('identifies final and legacy final statuses', () => {
    expect(isAdminPreOrderStatusFinal('completed')).toBe(true)
    expect(isAdminPreOrderStatusFinal('cancelado')).toBe(true)
    expect(isAdminPreOrderStatusFinal('pending')).toBe(false)
  })
})