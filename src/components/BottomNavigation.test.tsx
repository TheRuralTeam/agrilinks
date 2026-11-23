import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BottomNavigation from './BottomNavigation'

const mockNavigate = vi.fn()
const mockLocation = { pathname: '/app', search: '' }

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

vi.mock('../contexts/GuestGateContext', () => ({
  useGuestGate: () => ({
    isGuest: false,
    minutesLeft: 0,
    requireAuth: vi.fn(),
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
  beforeEach(() => {
    mockLocation.pathname = '/app'
    mockLocation.search = ''
  })

  it('exposes a stable label for each navigation button so the UI does not mix labels', () => {
    render(<BottomNavigation />)

    const homeButton = screen.getByRole('button', { name: /início/i })
    expect(homeButton).toHaveAttribute('aria-label', 'Início')

    for (const label of [/Mensagens/, 'Carrinho', /Notificações|Alertas/, 'Perfil']) {
      expect(screen.getByRole('button', { name: label })).toBeVisible()
    }
    expect(screen.queryByRole('button', { name: 'Mercado' })).not.toBeInTheDocument()
    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    const profileButton = screen.getByRole('button', { name: 'Perfil' })
    expect(profileButton).toBeVisible()
    expect(navigation.querySelectorAll('button')).toHaveLength(7)
    expect(navigation.querySelectorAll('button').item(6)).toBe(profileButton)
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(homeButton).toHaveAttribute('aria-current', 'page')
    expect(homeButton).toHaveClass('bg-primary/10', 'text-primary')

    expect(navigation).toHaveAttribute('translate', 'no')
    expect(navigation.querySelector('.truncate')).toBeNull()
  })

  it('marks the receiving form action as current on its page', () => {
    mockLocation.pathname = '/ficharecebimento'
    render(<BottomNavigation />)

    expect(screen.getByRole('button', { name: 'Criar ficha de recebimento' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('button').filter((button) => button.getAttribute('aria-current') === 'page')).toHaveLength(1)
  })
})
