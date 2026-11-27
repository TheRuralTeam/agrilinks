export type ProfileRole = 'agricultor' | 'comprador' | 'agente' | 'motorista' | string | null | undefined

export interface ProfileNameSource {
  full_name?: string | null
  name?: string | null
  company_name?: string | null
  business_name?: string | null
  email?: string | null
}

export const normalizeDisplayName = (value?: string | null) => {
  if (!value || typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ')
}

export const getProfileDisplayName = (source: ProfileNameSource = {}) => {
  const candidate = [
    source.full_name,
    source.name,
    source.company_name,
    source.business_name,
  ].find((value) => normalizeDisplayName(value))

  if (candidate) return normalizeDisplayName(candidate)

  return normalizeDisplayName(source.email?.split('@')[0]) || 'Utilizador'
}

export const getProfileRoleLabel = (role?: ProfileRole) => {
  switch ((role || '').toString().toLowerCase()) {
    case 'agricultor':
      return 'Fornecedor'
    case 'comprador':
      return 'Comprador'
    case 'agente':
      return 'Agente'
    case 'motorista':
      return 'Motorista'
    default:
      return 'Utilizador'
  }
}

export const resolveAvatarUrl = (value?: string | null) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null

  const isUnsafe = /^(javascript:|data:|vbscript:|about:)/i.test(raw)
  if (isUnsafe) return null

  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('https://') || raw.startsWith('http://')
      ? raw
      : null
  }
}
