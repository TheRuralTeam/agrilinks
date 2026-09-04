export const PUBLIC_PROFILE_FIELDS = [
  'full_name',
  'avatar_url',
  'verified',
  'user_type',
  'province_id',
  'municipality_id',
  'created_at',
  'bio',
  'description',
  'company_name',
  'display_name',
] as const

export const PUBLIC_PRODUCT_FIELDS = [
  'id',
  'product_type',
  'quantity',
  'price',
  'status',
  'harvest_date',
  'province_id',
  'municipality_id',
  'location',
  'farmer_name',
  'photos',
  'description',
  'created_at',
  'updated_at',
] as const

export const sanitizePublicProfile = <T extends Record<string, any>>(data: T | null | undefined) => {
  if (!data) return null as T | null

  const { id, email, phone, address, password, tokens, auth_token, secret, internal_notes, ...safe } = data
  const result: Record<string, any> = {}

  for (const key of Object.keys(safe)) {
    if (PUBLIC_PROFILE_FIELDS.includes(key as any) || key.startsWith('public_') || key === 'avatar_url') {
      result[key] = safe[key]
    }
  }

  return result as Partial<T>
}

export const sanitizePublicProduct = <T extends Record<string, any>>(data: T | null | undefined) => {
  if (!data) return null as T | null

  const { user_id, buyer_id, owner_id, seller_id, contact, email, phone, payment_details, internal_notes, sensitive, ...safe } = data
  const result: Record<string, any> = {}

  for (const key of Object.keys(safe)) {
    if (PUBLIC_PRODUCT_FIELDS.includes(key as any) || key.startsWith('public_')) {
      result[key] = safe[key]
    }
  }

  return result as Partial<T>
}

export const isNeutralPublicView = (user: { id?: string } | null | undefined) => !user || !user.id
