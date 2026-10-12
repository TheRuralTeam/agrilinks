import { supabase } from '../../integrations/supabase/client'

const table = () => (supabase as any).from('user_delivery_preferences')

/**
 * Recupera apenas a localização preferida do utilizador autenticado.
 * O RLS no Supabase impede o acesso a preferências de outras contas.
 */
export async function getPreferredDeliveryLocation(userId: string): Promise<string | null> {
  const { data, error } = await table()
    .select('delivery_location')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[AgriLink] Não foi possível recuperar a localização preferida.', error)
    return null
  }

  return typeof data?.delivery_location === 'string' ? data.delivery_location : null
}

/**
 * Guarda a última localização usada numa pré-compra concluída.
 * Falhas nesta preferência não devem impedir uma compra válida.
 */
export async function savePreferredDeliveryLocation(
  userId: string,
  location: string,
): Promise<void> {
  const normalized = location.trim().replace(/\s+/g, ' ')
  if (normalized.length < 3 || normalized.length > 180) return

  const { error } = await table().upsert({
    user_id: userId,
    delivery_location: normalized,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    console.warn('[AgriLink] A pré-compra foi concluída, mas não foi possível memorizar a localização.', error)
  }
}
