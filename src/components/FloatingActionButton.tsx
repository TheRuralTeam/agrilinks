import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const FloatingActionButton = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { userProfile } = useAuth()
  const userType = String(userProfile?.user_type ?? '').toLowerCase()

  // As restantes ações principais já existem na navegação inferior por perfil.
  // Para compradores, a ficha de recebimento é uma ação complementar ao carrinho.
  if (userType !== 'comprador') return null

  const active = location.pathname === '/ficharecebimento'

  return (
    <Button
      onClick={() => navigate('/ficharecebimento')}
      type="button"
      variant="ghost"
      className={`relative flex min-h-12 min-w-[4rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-foreground transition-colors duration-200 ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted active:bg-muted/80'
      }`}
      aria-label="Criar ficha de recebimento"
      title="Criar ficha de recebimento"
      aria-current={active ? 'page' : undefined}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <FileText strokeWidth={2.25} className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-h-[1.1rem] w-full items-center justify-center whitespace-nowrap text-center text-[9px] font-medium leading-none tracking-tight sm:text-[10px]">
        Ficha
      </span>
    </Button>
  )
}

export default FloatingActionButton
