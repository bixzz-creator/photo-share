import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CalendarDays, Camera } from 'lucide-react'
import { EventList } from '@/components/events/EventList'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/layout/StatCard'
import { getAuthContext } from '@/lib/auth'
import { listEventsWithCounts } from '@/lib/queries'

export const metadata: Metadata = { title: 'My dashboard' }

export default async function MemberDashboardPage() {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'member') redirect('/admin')

  const { supabase, userId } = context

  const [{ events, total }, { count: myPhotos }] = await Promise.all([
    listEventsWithCounts(supabase, { memberId: userId, page: 1, limit: 6 }),
    supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('uploaded_by', userId),
  ])

  const stats = [
    { label: 'Assigned events', value: total, icon: CalendarDays },
    { label: 'Photos you uploaded', value: myPhotos ?? 0, icon: Camera },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hi ${context.profile.full_name.split(' ')[0]}`}
        description="Here are the events you are covering."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            emphasis={stat.label === 'Assigned events'}
          />
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="title-display text-2xl">Your events</h2>
        <EventList
          events={events}
          basePath="/member/events"
          emptyMessage="You have not been assigned to any events yet. An admin needs to add you."
        />
      </section>
    </div>
  )
}
