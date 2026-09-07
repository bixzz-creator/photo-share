import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { EventList } from '@/components/events/EventList'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { getAuthContext } from '@/lib/auth'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { listEventsWithCounts } from '@/lib/queries'

export const metadata: Metadata = { title: 'Events' }

interface PageProps {
  searchParams: { page?: string }
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  const page = Math.max(1, Number(searchParams.page ?? '1') || 1)
  const { events, total, totalPages } = await listEventsWithCounts(context.supabase, {
    page,
    limit: DEFAULT_PAGE_SIZE,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={`${total} event${total === 1 ? '' : 's'} in total`}
        actions={
          <Button asChild>
            <Link href="/admin/events/create">
              <Plus className="h-4 w-4" />
              Create event
            </Link>
          </Button>
        }
      />

      <EventList
        events={events}
        canManage
        page={page}
        totalPages={totalPages}
        basePath="/admin/events"
        emptyMessage="No events on this page yet."
      />
    </div>
  )
}
