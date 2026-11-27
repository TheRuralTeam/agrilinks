import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../../lib/utils'
import { WalletSummaryCard } from './WalletSummaryCard'

const hasFormattedAmount = (amount: number) => (text: string) =>
  text.replace(/\u00a0/g, ' ') === formatCurrency(amount).replace(/\u00a0/g, ' ')

describe('WalletSummaryCard', () => {
  it('hides persisted balances by default and lets the user reveal and hide them', async () => {
    const user = userEvent.setup()
    render(
      <WalletSummaryCard
        balance={{ available_balance: 1250, blocked_balance: 75 }}
        loading={false}
        error={false}
      />,
    )

    expect(screen.getByText('••••••••')).toBeInTheDocument()
    expect(screen.getByLabelText('Saldo da carteira')).toBeInTheDocument()
    expect(screen.queryByText('Carteira')).not.toBeInTheDocument()
    expect(screen.queryByText('Saldo disponível')).not.toBeInTheDocument()
    expect(screen.queryByText('Saldo bloqueado')).not.toBeInTheDocument()
    expect(screen.queryByText(hasFormattedAmount(1250))).not.toBeInTheDocument()
    expect(screen.queryByText(hasFormattedAmount(75))).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mostrar saldo' }))
    expect(screen.getByText(hasFormattedAmount(1250))).toBeInTheDocument()
    expect(screen.queryByText(hasFormattedAmount(75))).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ocultar saldo' }))
    expect(screen.getByText('••••••••')).toBeInTheDocument()
  })

  it('starts hidden again when the owning account changes', async () => {
    const user = userEvent.setup()
    const balance = { available_balance: 1250, blocked_balance: 75 }
    const { rerender } = render(<WalletSummaryCard key="account-a" balance={balance} loading={false} error={false} />)

    await user.click(screen.getByRole('button', { name: 'Mostrar saldo' }))
    expect(screen.getByText(hasFormattedAmount(1250))).toBeInTheDocument()

    rerender(<WalletSummaryCard key="account-b" balance={balance} loading={false} error={false} />)
    expect(screen.getByText('••••••••')).toBeInTheDocument()
  })

  it('does not invent a zero balance when the wallet is missing', () => {
    render(<WalletSummaryCard balance={null} loading={false} error={false} />)

    expect(screen.getByText('Carteira indisponível')).toBeInTheDocument()
    expect(screen.queryByText(hasFormattedAmount(0))).not.toBeInTheDocument()
  })

  it('shows loading and database error states without an amount', () => {
    const { rerender } = render(<WalletSummaryCard balance={null} loading error={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('A consultar saldo...')

    rerender(<WalletSummaryCard balance={null} loading={false} error />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o saldo.')
  })
})
