import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FloatingActionButton from './FloatingActionButton'

const state = vi.hoisted(() => ({
  userProfile: { user_type: 'comprador' as string | null },
  pathname: '/app',
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => state.navigate,
  useLocation: () => ({ pathname: state.pathname }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: state.userProfile }),
}))

describe('FloatingActionButton', () => {
  beforeEach(() => {
    state.userProfile = { user_type: 'comprador' }
    state.pathname = '/app'
    state.navigate.mockReset()
  })

  it('shows the distinct buyer action with a truthful accessible label', () => {
    render(<FloatingActionButton />)

    const button = screen.getByRole('button', { name: 'Criar ficha de recebimento' })
    fireEvent.click(button)

    expect(state.navigate).toHaveBeenCalledWith('/ficharecebimento')
  })

  it.each(['agricultor', 'agente', 'motorista', 'unknown', null])(
    'does not duplicate the primary navigation action for role %s',
    (userType) => {
      state.userProfile = userType ? { user_type: userType } : null
      render(<FloatingActionButton />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('does not show the create action while already on the receiving form', () => {
    state.pathname = '/ficharecebimento'
    render(<FloatingActionButton />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
