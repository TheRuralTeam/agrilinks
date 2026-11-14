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
  if (userType !== 'comprador' || location.pathname === '/ficharecebimento') return null

  return (
    <Button
      onClick={() => navigate('/ficharecebimento')}
      size="lg"
      className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full border border-primary-foreground/20 bg-primary text-primary-foreground shadow-strong transition-[transform,background-color,box-shadow] duration-200 hover:bg-primary-hover active:scale-95"
      aria-label="Criar ficha de recebimento"
      title="Criar ficha de recebimento"
    >
      <FileText strokeWidth={2.25} className="h-6 w-6" aria-hidden="true" />
    </Button>
  )
}

export default FloatingActionButton
