export type PublicAction =
  | 'browse'
  | 'purchase'
  | 'like'
  | 'comment'
  | 'reply'
  | 'message'
  | 'chat'
  | 'follow'
  | 'review'
  | 'checkout'
  | 'pre_order'
  | 'edit_profile'
  | 'publish_product'
  | 'contract'
  | 'unknown'

export const canAccessVisitorProfile = (_user?: unknown | null) => true

export const requiresLoginForAction = (action: string | PublicAction) => {
  const normalized = String(action || '').toLowerCase()
  const sensitiveActions = new Set<string>([
    'purchase',
    'buy',
    'like',
    'comment',
    'reply',
    'message',
    'chat',
    'follow',
    'review',
    'checkout',
    'pre_order',
    'pre-order',
    'publish_product',
    'edit_profile',
    'contract',
    'order',
    'converse',
  ])

  return sensitiveActions.has(normalized) || normalized.includes('buy') || normalized.includes('like') || normalized.includes('comment') || normalized.includes('purchase') || normalized.includes('order')
}
