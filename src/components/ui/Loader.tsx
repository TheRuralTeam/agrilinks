import agrilinkLogo from '../../assets/LogoAgriLinkOfficiallNoBackground.png'

interface LoaderProps {
  compact?: boolean
  label?: string
  className?: string
}

const Loader = ({ compact = false, label = '', className = '' }: LoaderProps) => {
  const ringSize = compact ? 'h-14 w-14' : 'h-16 w-16'
  const logoSize = compact ? 'h-8 w-auto' : 'h-9 w-auto'

  const content = (
    <div className={`relative flex items-center justify-center ${ringSize} ${className}`} role="status" aria-live="polite" aria-label="Loading">
      <div className="absolute inset-0 animate-pulse rounded-full border-[3px] border-[#2c863b]/50" />
      <img src={agrilinkLogo} alt="AgriLink" className={`${logoSize} relative z-10 object-contain agrilink-loading-logo`} />
      <style>{`
        .agrilink-loading-logo {
          transform-origin: center;
          animation: agrilink-loading-motion 2.4s ease-in-out infinite;
        }
        @keyframes agrilink-loading-motion {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
          25% { transform: translate3d(1px, -2px, 0) rotate(-2deg) scale(1.03); }
          50% { transform: translate3d(0, -3px, 0) rotate(0deg) scale(1.05); }
          75% { transform: translate3d(-1px, -2px, 0) rotate(2deg) scale(1.03); }
        }
        @media (prefers-reduced-motion: reduce) {
          .agrilink-loading-logo { animation: none; }
        }
      `}</style>
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center px-6 bg-transparent backdrop-blur-[2px]">
      {content}
    </div>
  )
}

export default Loader
export { Loader }
