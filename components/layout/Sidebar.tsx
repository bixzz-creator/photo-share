'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Aperture, CalendarDays, LayoutDashboard } from 'lucide-react'
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
      className="flex h-full flex-col bg-rail p-3 text-rail-foreground"
      aria-label="Main navigation"
    >
      <Link
        href={role === 'admin' ? '/admin' : '/member'}
        onClick={onNavigate}
        className="mb-7 flex items-center gap-3 px-3 py-2"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brass text-brass-foreground">
          <Aperture className="h-[1.15rem] w-[1.15rem]" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="title-display text-[1.05rem] text-rail-foreground">
            PhotoShare
          </span>
          <span className="eyebrow text-base text-rail-muted">Studio</span>
        </span>
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
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
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
