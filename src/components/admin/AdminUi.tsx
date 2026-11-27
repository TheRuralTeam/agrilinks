import type { ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

export function MetricCard({
  title,
  value,
  trend,
  trendLabel = '30 dias',
  icon,
  color,
}: {
  title: string
  value: number | string
  trend?: number | null
  trendLabel?: string
  icon: ReactNode
  color: string
}) {
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-gray-500 sm:text-sm">{title}</p>
          <p className="mt-1 text-xl font-bold text-gray-900 sm:text-3xl">{value}</p>
          {trend != null && TrendIcon ? (
            <p className={`mt-1 flex items-center gap-1 text-xs font-semibold sm:text-sm ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              <TrendIcon className="h-3 w-3" />{trend >= 0 ? '+' : ''}{trend}% · {trendLabel}
            </p>
          ) : <p className="mt-1 text-[11px] text-gray-400">Sem histórico comparável</p>}
        </div>
        <div className={`flex-shrink-0 rounded-xl p-2 text-white sm:p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  )
}

export function SidebarItem({
  active,
  onClick,
  icon,
  children,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${active ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`}>{icon}</span>
      <span className="flex-1 truncate text-left">{children}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}