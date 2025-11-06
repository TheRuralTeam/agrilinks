import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Feather, FileText, ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const FloatingActionButton = () => {
  const navigate = useNavigate()
  const { userProfile } = useAuth()

  if (!userProfile) return null

  // Configuração para cada tipo de usuário
  const actionConfig = {
    agricultor: {
      icon: (
        <Feather
          strokeWidth={3}
          className="h-7 w-7 text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse"
        />
      ),
      path: '/publicar-produto',
      shadowColor: 'shadow-[0_0_25px_rgba(34,197,94,0.45)]',
    },
    comprador: {
      icon: (
        <FileText
          strokeWidth={3}
          className="h-7 w-7 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse"
        />
      ),
      path: '/ficharecebimento',
      shadowColor: 'shadow-[0_0_25px_rgba(250,204,21,0.45)]',
    },
    agente: {
      icon: (
        <ClipboardCheck
          strokeWidth={3}
          className="h-7 w-7 text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse"
        />
      ),
      path: '/publicar-produto',
      shadowColor: 'shadow-[0_0_25px_rgba(168,85,247,0.45)]',
    },
  }[userProfile.user_type]

  if (!actionConfig) return null

  return (
    <Button
      onClick={() => navigate(actionConfig.path)}
      size="lg"
      className={`
        fixed bottom-24 right-4 z-40 
        h-16 w-16 rounded-full 
        bg-white/35 backdrop-blur-md 
        hover:bg-white/45 active:scale-95
        ${actionConfig.shadowColor}
        transition-all duration-300
      `}
    >
      <div className="animate-float">{actionConfig.icon}</div>
    </Button>
  )
}

export default FloatingActionButton
