import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useGuestGate } from '../contexts/GuestGateContext'
import { toast } from 'sonner'
import { requiresLoginForAction } from '../lib/accessPolicy'

/**
 * Gate de acções da plataforma.
 * - Visitantes sem login: apenas visualização.
 * - Utilizadores com e-mail não confirmado: apenas visualização.
 * - Apenas utilizadores com e-mail confirmado podem executar acções.
 */
export const useCanAct = () => {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const { requireAuth } = useGuestGate()

  const isLoggedIn = !!user
  const emailConfirmed = !!(user as any)?.email_confirmed_at || !!userProfile?.email_verified
  const identityDocument = userProfile?.identity_document?.trim() || ''
  const canAct = isLoggedIn && emailConfirmed

  const requireAct = (action = 'esta acção') => {
    if (!isLoggedIn) {
      if (requiresLoginForAction(action)) {
        requireAuth('Precisas de uma conta AgriLink para ' + action + '.')
        return false
      }
      return true
    }
    if (!emailConfirmed) {
      toast.error('Confirme o seu e-mail para executar ' + action, {
        action: { label: 'Confirmar', onClick: () => navigate('/confirmar-email') },
      })
      return false
    }
    // BI/NIF is requested by the operation itself when the server requires legal identity.
    // This keeps ordinary browsing/profile use open after email confirmation.
    return true
  }

  return { canAct, isLoggedIn, emailConfirmed, identityDocument, requireAct }
}
