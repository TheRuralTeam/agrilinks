import { Eye, EyeOff, Wallet } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency } from '../../lib/utils'
import type { WalletBalance } from './walletDomain'

interface WalletSummaryCardProps {
  balance: WalletBalance | null
  loading: boolean
  error: boolean
}

export function WalletSummaryCard({ balance, loading, error }: WalletSummaryCardProps) {
  const [showBalances, setShowBalances] = useState(false)

  return (
    <section aria-label="Saldo da carteira" className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Wallet className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />

      {loading ? (
        <p role="status" className="min-w-0 flex-1 text-sm text-muted-foreground">A consultar saldo...</p>
      ) : error ? (
        <p role="alert" className="min-w-0 flex-1 text-sm text-foreground">Não foi possível carregar o saldo.</p>
      ) : balance ? (
        <p className="min-w-0 flex-1 break-words text-xl font-bold tabular-nums text-foreground sm:text-2xl">
          {showBalances ? formatCurrency(balance.available_balance) : '••••••••'}
        </p>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Carteira indisponível</p>
      )}

      {balance && !loading && !error && (
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setShowBalances((visible) => !visible)}
          aria-label={showBalances ? 'Ocultar saldo' : 'Mostrar saldo'}
          aria-pressed={showBalances}
        >
          {showBalances ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </section>
  )
}