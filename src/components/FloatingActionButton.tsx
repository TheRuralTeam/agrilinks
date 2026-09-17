import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { Feather, FileText, ClipboardCheck, Truck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const FloatingActionButton = () => {
  const navigate = useNavigate()
  const { userProfile } = useAuth()

  if (!userProfile) return null

  // Configuração para cada tipo de usuário
  const actionConfig = {
    agricultor: {
      icon: (
        <Feather
            strokeWidth={2.25}
            className="h-6 w-6"
        />
      ),
      path: '/publicar-produto',
      shadowColor: 'shadow-[0_0_25px_rgba(34,197,94,0.45)]',
    },
    comprador: {
      icon: (
        <FileText
          strokeWidth={2.25}
          className="h-6 w-6"
        />
      ),
      path: '/ficharecebimento',
      shadowColor: 'shadow-[0_0_25px_rgba(250,204,21,0.45)]',
    },
    agente: {
      icon: (
        <ClipboardCheck
          strokeWidth={2.25}
          className="h-6 w-6"
        />
      ),
      path: '/publicar-produto',
      shadowColor: 'shadow-[0_0_25px_rgba(44,134,59,0.45)]',
    },
    motorista: {
      icon: (
        <Truck
          strokeWidth={2.25}
          className="h-6 w-6"
        />
      ),
      path: '/cargas',
      shadowColor: 'shadow-[0_0_25px_rgba(176,125,10,0.45)]',
    },
  }[userProfile.user_type]

  if (!actionConfig) return null

  return (
    <Button
      onClick={() => navigate(actionConfig.path)}
      size="lg"
      className={`
        fixed bottom-24 right-4 z-40 
        h-14 w-14 rounded-full border border-primary-foreground/20
        bg-primary text-primary-foreground shadow-strong
        hover:bg-primary-hover active:scale-95
        ${actionConfig.shadowColor.replace(/shadow-\[[^\]]+\]/, '')}
        transition-[transform,background-color,box-shadow] duration-200
      `}
      aria-label="Criar nova ação"
    >
      <div className="animate-float">{actionConfig.icon}</div>
    </Button>
  )
}

export default FloatingActionButton
