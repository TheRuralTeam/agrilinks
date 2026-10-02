import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BottomNavigation from './BottomNavigation'

const mockNavigate = vi.fn()
const mockLocation = { pathname: '/app' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'navigation.home': 'Início',
      'navigation.map': 'Mapa',
      'navigation.messages': 'Mensagens',
      'navigation.publish': 'Publicar',
      'navigation.notifications': 'Alertas',
      'navigation.profile': 'Perfil',
    }[key] ?? key),
  }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: false,
    user: { id: 'user-1' },
    userProfile: { user_type: 'comprador' },
  }),
}))

vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            then: () => Promise.resolve({ count: 0 }),
          }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
      subscribe: () => ({})
    }),
    removeChannel: vi.fn(),
  },
}))

describe('BottomNavigation', () => {
  it('exposes a stable label for each navigation button so the UI does not mix labels', () => {
    render(<BottomNavigation />)

    const homeButton = screen.getByRole('button', { name: /início/i })
    expect(homeButton).toHaveAttribute('aria-label', 'Início')
  })
})
