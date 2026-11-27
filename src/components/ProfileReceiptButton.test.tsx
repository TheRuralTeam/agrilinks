import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProfileReceiptButton from './ProfileReceiptButton'

const state = vi.hoisted(() => ({
  userProfile: { user_type: 'comprador' } as { user_type: string } | null,
  pathname: '/perfil',
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => state.navigate,
  useLocation: () => ({ pathname: state.pathname }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: state.userProfile }),
}))

describe('ProfileReceiptButton', () => {
  beforeEach(() => {
    state.userProfile = { user_type: 'comprador' }
    state.pathname = '/perfil'
    state.navigate.mockReset()
  })

  it('lets buyers open the receiving form from their profile', () => {
    render(<ProfileReceiptButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Criar ficha de recebimento' }))

    expect(state.navigate).toHaveBeenCalledWith('/ficharecebimento')
  })

  it.each(['agricultor', 'agente', 'motorista', 'unknown', null])(
    'does not show the buyer-only action for role %s',
    (userType) => {
      state.userProfile = userType ? { user_type: userType } : null
      render(<ProfileReceiptButton />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('marks the receiving form as the current destination', () => {
    state.pathname = '/ficharecebimento'
    render(<ProfileReceiptButton />)

    expect(screen.getByRole('button', { name: 'Criar ficha de recebimento' })).toHaveAttribute('aria-current', 'page')
  })
})