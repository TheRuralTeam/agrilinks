import { useLocation, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Button } from './ui/button'
import { useAuth } from '../contexts/AuthContext'

export default function ProfileReceiptButton() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (String(userProfile?.user_type ?? '').toLowerCase() !== 'comprador') return null

  const active = location.pathname === '/ficharecebimento'

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => navigate('/ficharecebimento')}
      className="min-h-10 justify-center gap-2 whitespace-normal px-3 text-xs"
      style={{ gridColumn: 'span 2' }}
      aria-label="Criar ficha de recebimento"
      aria-current={active ? 'page' : undefined}
    >
      <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
      Criar ficha de recebimento
    </Button>
  )
}