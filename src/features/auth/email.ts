const ALLOWED_REDIRECT_HOSTS = ['agrilink.ao', 'www.agrilink.ao', 'agrilinks.lovable.app', 'localhost']

export const getAppRedirectBase = () => {
  const configured = (import.meta.env.VITE_APP_URL || import.meta.env.VITE_SITE_URL || window.location.origin || 'https://agrilink.ao').replace(/\/$/, '')
  return configured
}

export const getSupabaseAuthCallbackUrl = () => {
  const configured = (import.meta.env.VITE_SUPABASE_URL || 'https://oqcrfqtlfqwrxxmsjpaf.supabase.co').replace(/\/$/, '')
  return `${configured}/auth/v1/callback`
}

export const normalizeEmailAddress = (email: string) => {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Email inválido.')
  }
  return normalized
}

const sanitizeNextPath = (next: string = '/app') => {
  let candidate = typeof next === 'string' ? next.trim() : '/app'

  try {
    candidate = decodeURIComponent(candidate)
  } catch {
    // Keep the original value when the string is not a valid percent-encoded URL.
  }

  if (!candidate || candidate.startsWith('//') || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate)) {
    throw new Error('URL de redirect inválida.')
  }

  const safePath = candidate.startsWith('/') ? candidate : '/app'

  try {
    const resolved = new URL(safePath, window.location.origin)
    const hostname = resolved.hostname.toLowerCase()
    const allowed = ALLOWED_REDIRECT_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))

    if (!allowed && resolved.origin !== window.location.origin) {
      throw new Error('URL de redirect inválida.')
    }

    return safePath
  } catch {
    throw new Error('URL de redirect inválida.')
  }
}

export const buildAuthRedirectUrl = (next: string = '/app') => {
  const safeNext = sanitizeNextPath(next)
  return `${getAppRedirectBase()}/auth/callback?next=${encodeURIComponent(safeNext)}`
}

const invokeEmailFunction = async (functionName: string, body: Record<string, unknown>) => {
  const { data, error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke(
    functionName,
    { body },
  )

  if (error) {
    const details = error?.context ? await error.context.json().catch(() => null) : null
    throw new Error(details?.error || details?.details || error.message || 'Não foi possível enviar o email.')
  }

  if (!data) {
    throw new Error('A Edge Function não retornou nenhuma resposta.')
  }

  if (data.error) {
    throw new Error(data.error)
  }

  if (data.success !== true) {
    throw new Error('O servidor não confirmou o envio do email.')
  }

  return data
}

export const sendMagicLink = async ({
  email,
  full_name,
  next = '/app',
  type = 'magiclink',
}: {
  email: string
  full_name?: string
  next?: string
  type?: 'magiclink' | 'signup' | 'email' | 'recovery'
}) => {
  const cleanedEmail = normalizeEmailAddress(email)
  const redirectTo = buildAuthRedirectUrl(next)

  return invokeEmailFunction('send-magic-link', {
    email: cleanedEmail,
    full_name: full_name?.trim() || undefined,
    redirect_to: redirectTo,
    type,
  })
}

export const sendConfirmationEmail = async ({
  email,
  full_name,
  next = '/app',
}: {
  email: string
  full_name?: string
  next?: string
}) => {
  const cleanedEmail = normalizeEmailAddress(email)
  const redirectTo = buildAuthRedirectUrl(next)

  return invokeEmailFunction('send-confirmation-email', {
    email: cleanedEmail,
    full_name: full_name?.trim() || undefined,
    redirect_to: redirectTo,
  })
}

export const sendPasswordResetEmail = async ({
  email,
  next = '/reset-password',
}: {
  email: string
  next?: string
}) => {
  const cleanedEmail = normalizeEmailAddress(email)
  const redirectTo = buildAuthRedirectUrl(next)

  return invokeEmailFunction('send-password-reset', {
    email: cleanedEmail,
    redirect_to: redirectTo,
  })
}

export const sendSupportEmail = async ({
  name,
  email,
  phone,
  message,
}: {
  name: string
  email: string
  phone?: string
  message: string
}) => {
  return invokeEmailFunction('send-support-email', {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || undefined,
    message: message.trim(),
  })
}

export const sendOrderUpdateEmail = async ({
  email,
  customer_name,
  order_id,
  status,
  message,
  next = '/app',
}: {
  email: string
  customer_name?: string
  order_id: string
  status: string
  message: string
  next?: string
}) => {
  return invokeEmailFunction('send-order-update-email', {
    email: email.trim().toLowerCase(),
    customer_name: customer_name?.trim() || undefined,
    order_id: order_id.trim(),
    status: status.trim(),
    message: message.trim(),
    redirect_to: buildAuthRedirectUrl(next),
  })
}
