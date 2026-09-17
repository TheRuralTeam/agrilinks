import { LoaderCircle } from 'lucide-react'

interface LoaderProps {
  compact?: boolean
  label?: string
  className?: string
}

const Loader = ({ compact = false, label = 'A carregar', className = '' }: LoaderProps) => {
  const content = (
    <div className={`flex items-center ${compact ? 'gap-2' : 'flex-col gap-3'} ${className}`} role="status" aria-live="polite">
      <LoaderCircle className={compact ? 'h-4 w-4 animate-spin text-[#2c863b]' : 'h-7 w-7 animate-spin text-[#2c863b]'} aria-hidden="true" />
      {label && <span className="text-xs font-medium text-[#758a79]">{label}</span>}
    </div>
  )

  if (compact) return content

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9f7] px-6 text-[#111714]">
      {content}
    </div>
  )
}

export default Loader
export { Loader }
