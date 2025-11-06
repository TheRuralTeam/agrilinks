import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Home, Map, Bell, MessageSquare, User, Plus, FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const BottomNavigation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { userProfile } = useAuth()

  // Determinar o ícone e caminho de publicação baseado no tipo de usuário
  const getPublishAction = () => {
    if (!userProfile) return null
    
    if (userProfile.user_type === 'comprador') {
      return { icon: FileText, label: 'Ficha', path: '/ficharecebimento' }
    } else {
      return { icon: Plus, label: 'Publicar', path: '/publicar-produto' }
    }
  }

  const publishAction = getPublishAction()

  const navItems = [
    { icon: Home, label: 'Home', path: '/app' },
    ...(publishAction ? [publishAction] : []),
    { icon: Map, label: 'Mapa', path: '/mapa' },
    { icon: Bell, label: 'Notificações', path: '/notificacoes' },
    { icon: MessageSquare, label: 'Mensagens', path: '/listamensagens' },
    { icon: User, label: 'Perfil', path: '/perfil' }
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="grid grid-cols-6 gap-1 p-2">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 h-auto py-2 px-1 ${
              isActive(item.path)
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

export default BottomNavigation