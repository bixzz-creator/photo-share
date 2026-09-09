'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/constants'

interface DashboardShellProps {
  fullName: string
  email: string
  role: UserRole
  children: React.ReactNode
}

export function DashboardShell({ fullName, email, role, children }: DashboardShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Navigating on mobile should close the drawer behind you.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-rail transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar role={role} onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* min-w-0 keeps wide children (tables, photo grids) inside the column
          instead of pushing the whole page sideways. */}
      <div className="flex min-w-0 flex-col lg:pl-64">
        <Topbar
          fullName={fullName}
          email={email}
          role={role}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <main
          key={pathname}
          className="page-stage mx-auto w-full min-w-0 max-w-[1400px] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
