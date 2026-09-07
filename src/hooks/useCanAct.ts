import { useAuth } from '../contexts/AuthContext'
import { useGuestGate } from '../contexts/GuestGateContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

/**
 * Gate de acções da plataforma.
 * - Visitantes sem login: apenas visualização.
 * - Utilizadores com e-mail não confirmado: apenas visualização.
 * - Apenas utilizadores com e-mail confirmado podem executar acções.
 */
export const useCanAct = () => {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()
  const { requireAuth } = useGuestGate()

  const isLoggedIn = !!user
  const emailConfirmed = !!(user as any)?.email_confirmed_at || !!userProfile?.email_verified
  const canAct = isLoggedIn && emailConfirmed

  const requireAct = (action = 'esta acção') => {
    if (!isLoggedIn) {
      requireAuth('Precisas de uma conta AgriLink para ' + action + '.')
      return false
    }
    if (!emailConfirmed) {
      toast.error('Confirme o seu e-mail para executar ' + action, {
        action: { label: 'Confirmar', onClick: () => navigate('/confirmar-email') },
      })
      return false
    }
    return true
  }

  return { canAct, isLoggedIn, emailConfirmed, requireAct }
}
