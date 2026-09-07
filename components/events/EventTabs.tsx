'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Images, Share2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EventTabsProps {
  eventId: string
}

/**
 * Navigation between an event's screens.
 *
 * This used to live in the sidebar, which meant the shared layout had to fetch
 * the event over the API on every navigation just to label the section. Keeping
 * it on the page removes that round trip and puts the tabs next to the content
 * they switch.
 */
export function EventTabs({ eventId }: EventTabsProps) {
  const pathname = usePathname()
  const base = `/admin/events/${eventId}`

  const tabs = [
    { href: base, label: 'Overview', icon: Images },
    { href: `${base}/photos`, label: 'Photos', icon: Camera },
    { href: `${base}/members`, label: 'Team', icon: Users },
    { href: `${base}/gallery`, label: 'Gallery', icon: Share2 },
  ]

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] border-b">
      <nav className="flex min-w-max gap-1 px-1" aria-label="Event sections">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brass text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
