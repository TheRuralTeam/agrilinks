export const ADMIN_PERMISSIONS = [
  'manage_users',
  'manage_products',
  'manage_orders',
  'manage_support',
  'manage_sourcing',
  'view_analytics',
  'manage_admins',
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

export const isAdminPermission = (value: string): value is AdminPermission =>
  (ADMIN_PERMISSIONS as readonly string[]).includes(value)

export const hasAdminAccess = ({
  isAdmin,
  isRootAdmin,
  isSuperRoot,
}: {
  isAdmin: boolean
  isRootAdmin: boolean
  isSuperRoot: boolean
}) => isAdmin || isRootAdmin || isSuperRoot
