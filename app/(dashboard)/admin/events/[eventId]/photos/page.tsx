import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { EventTabs } from '@/components/events/EventTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { PhotoSelector } from '@/components/photos/PhotoSelector'
import { getAuthContext } from '@/lib/auth'
import { listEventPhotos } from '@/lib/queries'

export const metadata: Metadata = { title: 'Review photos' }

interface PageProps {
  params: { eventId: string }
}

export default async function AdminEventPhotosPage({ params }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  const [{ data: event }, { photos, total, selectedCount, limit }] = await Promise.all([
    context.supabase.from('events').select('id, name').eq('id', params.eventId).maybeSingle(),
    listEventPhotos(context.supabase, params.eventId),
  ])

  if (!event) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/admin/events/${event.id}`}
        backLabel={event.name}
        title="Review photos"
        description="Tick the photos that should appear in the customer gallery."
      />

      <EventTabs eventId={event.id} />

      <PhotoSelector
        eventId={event.id}
        photos={photos}
        total={total}
        selectedCount={selectedCount}
        pageSize={limit}
      />
    </div>
  )
}
