import React from 'react'
import BottomNavigation from '@/components/BottomNavigation'
import FloatingActionButton from '@/components/FloatingActionButton'

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <FloatingActionButton />
      <BottomNavigation />
    </div>
  )
}

export default AppLayout