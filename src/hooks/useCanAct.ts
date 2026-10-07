import { useAuth } from '../contexts/AuthContext'
import { useGuestGate } from '../contexts/GuestGateContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { requiresLoginForAction } from '../lib/accessPolicy'

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
  const identityDocument = userProfile?.identity_document?.trim() || ''
  const identityRequiredActions = ['fazer uma pré-compra', 'publicar um produto', 'publicar uma carga', 'criar um contrato de futuros', 'criar uma ficha']
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
    const needsIdentity = identityRequiredActions.some((required) => action.toLowerCase().includes(required))
    if (needsIdentity && !identityDocument) {
      toast.error('Para ' + action + ', informe primeiro o número do Bilhete de Identidade ou NIF.', {
        action: { label: 'Informar', onClick: () => navigate('/completar-perfil?required=identity') },
      })
      return false
    }
    return true
  }

  return { canAct, isLoggedIn, emailConfirmed, identityDocument, requireAct }
}
