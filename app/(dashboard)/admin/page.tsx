import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Camera, Plus, Share2, Users } from 'lucide-react'
import { EventList } from '@/components/events/EventList'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/layout/StatCard'
import { Button } from '@/components/ui/button'
import { getAuthContext } from '@/lib/auth'
import { listEventsWithCounts } from '@/lib/queries'

export const metadata: Metadata = { title: 'Admin dashboard' }

const STAT_ICONS = {
  events: CalendarDays,
  photos: Camera,
  members: Users,
  galleries: Share2,
} as const

export default async function AdminDashboardPage() {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  const { supabase } = context

  const [
    { count: eventCount },
    { count: photoCount },
    { count: memberCount },
    { count: galleryCount },
    { events },
  ] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('photos').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'member'),
    supabase
      .from('galleries')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true),
    listEventsWithCounts(supabase, { page: 1, limit: 5 }),
  ])

  const stats = [
    { key: 'events' as const, label: 'Total events', value: eventCount ?? 0 },
    { key: 'photos' as const, label: 'Total photos', value: photoCount ?? 0 },
    { key: 'members' as const, label: 'Team members', value: memberCount ?? 0 },
    { key: 'galleries' as const, label: 'Published galleries', value: galleryCount ?? 0 },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${context.profile.full_name}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/events">View all events</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/events/create">
                <Plus className="h-4 w-4" />
                Create event
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={stat.value}
            icon={STAT_ICONS[stat.key]}
            emphasis={stat.key === 'photos'}
          />
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="title-display text-2xl">Recent events</h2>
          {(eventCount ?? 0) > events.length && (
            <Link
              href="/admin/events"
              className="text-sm font-medium text-primary hover:underline"
            >
              See all {eventCount}
            </Link>
          )}
        </div>
        <EventList
          events={events}
          canManage
          emptyMessage="Create your first event to start collecting photos."
        />
      </section>
    </div>
  )
}
