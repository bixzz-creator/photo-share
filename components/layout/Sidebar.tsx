'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, LayoutDashboard } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/constants'

interface SidebarProps {
  role: UserRole
  onNavigate?: () => void
}

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const items: NavItem[] =
    role === 'admin'
      ? [
          { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/admin/events', label: 'Events', icon: CalendarDays },
        ]
      : [
          { href: '/member', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/member/events', label: 'My events', icon: CalendarDays },
        ]

  return (
    <nav
      className="flex h-full flex-col bg-rail p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-rail-foreground"
      aria-label="Main navigation"
    >
      <Link
        href={role === 'admin' ? '/admin' : '/member'}
        onClick={onNavigate}
        className="mb-8 px-2 py-1"
      >
        <Logo onDark />
      </Link>

      <p className="eyebrow px-3 pb-2 text-base text-rail-muted">
        {role === 'admin' ? 'Workspace' : 'My work'}
      </p>

      <div className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          // Sub-pages keep their section highlighted, but "/admin" must not
          // stay active on "/admin/events".
          const isActive =
            href === pathname ||
            (href !== '/admin' && href !== '/member' && pathname.startsWith(href))

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? 'bg-rail-accent font-medium text-rail-foreground'
                  : 'text-rail-muted hover:bg-rail-accent/60 hover:text-rail-foreground'
              )}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brass"
                  aria-hidden="true"
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </div>

      <p className="eyebrow mt-auto border-t border-white/5 px-3 pt-3 text-base text-rail-muted">
        {role === 'admin' ? 'Administrator' : 'Photographer'}
      </p>
    </nav>
  )
}
