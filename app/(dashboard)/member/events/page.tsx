import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { EventList } from '@/components/events/EventList'
import { PageHeader } from '@/components/layout/PageHeader'
import { getAuthContext } from '@/lib/auth'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { listEventsWithCounts } from '@/lib/queries'

export const metadata: Metadata = { title: 'My events' }

interface PageProps {
  searchParams: { page?: string }
}

export default async function MemberEventsPage({ searchParams }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'member') redirect('/admin')

  const page = Math.max(1, Number(searchParams.page ?? '1') || 1)
  const { events, total, totalPages } = await listEventsWithCounts(context.supabase, {
    memberId: context.userId,
    page,
    limit: DEFAULT_PAGE_SIZE,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="My events"
        description={`${total} assigned event${total === 1 ? '' : 's'}`}
      />

      <EventList
        events={events}
        page={page}
        totalPages={totalPages}
        basePath="/member/events"
        emptyMessage="No assigned events yet."
      />
    </div>
  )
}
