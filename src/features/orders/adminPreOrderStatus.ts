export const ADMIN_PRE_ORDER_STATUSES = ['pending', 'accepted', 'rejected'] as const

export type AdminPreOrderStatus = (typeof ADMIN_PRE_ORDER_STATUSES)[number]

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceite',
  rejected: 'Removido',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  concluida: 'Concluído',
  cancelado: 'Cancelado',
  aguardando: 'Pendente',
}

export function getAdminPreOrderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function isAdminPreOrderStatusFinal(status: string): boolean {
  return ['completed', 'cancelled', 'concluida', 'cancelado'].includes(status)
}