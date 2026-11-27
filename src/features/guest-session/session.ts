/**
 * AgriLink — Modo Convidado (Guest Mode)
 *
 * Permite ao visitante experimentar a plataforma sem conta.
 * Tudo o que o convidado "cria" fica apenas em localStorage e
 * expira automaticamente ao fim de 2 horas.
 */

export const GUEST_KEY = 'agrilink_guest_session'
export const GUEST_TTL_MS = 2 * 60 * 60 * 1000 // 2 horas

export interface GuestSession {
  createdAt: number
  expiresAt: number
  data: {
    profile?: Record<string, any>
    products?: any[]
    fichas?: any[]
    [k: string]: any
  }
}

const now = () => Date.now()

export const GUEST_PROFILE = {
  id: 'guest',
  full_name: 'Visitante',
  email: 'visitante@agrilink.ao',
  phone: '',
  avatar_url: null as string | null,
  user_type: 'comprador' as 'comprador' | 'agricultor' | 'agente',
  province_id: 'Luanda',
  municipality_id: 'Luanda',
  identity_document: '',
  email_verified: false,
  verified: false,
  agent_code: null,
  created_at: new Date().toISOString(),
  is_guest: true,
}

function read(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestSession
    if (!parsed?.expiresAt || parsed.expiresAt < now()) {
      localStorage.removeItem(GUEST_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(GUEST_KEY)
    return null
  }
}

function write(session: GuestSession) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(session))
  } catch {
    /* storage cheio ou indisponível — modo convidado degrada em silêncio */
  }
}

/** Cria (ou renova) a sessão de convidado e devolve-a. */
export function ensureGuestSession(): GuestSession {
  const existing = read()
  if (existing) return existing
  const session: GuestSession = {
    createdAt: now(),
    expiresAt: now() + GUEST_TTL_MS,
    data: { profile: { ...GUEST_PROFILE }, products: [], fichas: [] },
  }
  write(session)
  return session
}

/** Limpa dados de convidado expirados. Chamar no arranque da app. */
export function purgeExpiredGuestSession() {
  read()
}

export function clearGuestSession() {
  try {
    localStorage.removeItem(GUEST_KEY)
  } catch {
    /* noop */
  }
}

export function getGuestData<T = any>(key: string, fallback: T): T {
  const s = read()
  if (!s) return fallback
  return (s.data?.[key] as T) ?? fallback
}

export function setGuestData(key: string, value: any) {
  const s = ensureGuestSession()
  s.data[key] = value
  write(s)
}

/** Acrescenta um item a uma lista guardada no modo convidado. */
export function pushGuestItem(key: string, item: any) {
  const list = getGuestData<any[]>(key, [])
  const entry = { ...item, id: `guest-${key}-${now()}`, created_at: new Date().toISOString(), is_guest: true }
  setGuestData(key, [entry, ...list])
  return entry
}

export function getGuestProfile() {
  return { ...GUEST_PROFILE, ...getGuestData<Record<string, any>>('profile', {}) }
}

export function updateGuestProfile(patch: Record<string, any>) {
  setGuestData('profile', { ...getGuestProfile(), ...patch })
}

/** Minutos restantes até o modo de teste expirar. */
export function guestMinutesLeft(): number {
  const s = read()
  if (!s) return 0
  return Math.max(0, Math.round((s.expiresAt - now()) / 60000))
}
