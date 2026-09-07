import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PaginatedPhotoGrid } from '@/components/photos/PaginatedPhotoGrid'
import { PhotoUploader } from '@/components/photos/PhotoUploader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAuthContext, isAssignedToEvent } from '@/lib/auth'
import { listEventPhotos } from '@/lib/queries'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Upload photos' }

interface PageProps {
  params: { eventId: string }
}

export default async function MemberUploadPage({ params }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'member') redirect('/admin')

  // The access check runs alongside the reads rather than in front of them:
  // every query here goes through the member's own RLS-scoped client, so an
  // unassigned member gets nothing back and is redirected before render.
  const [assigned, { data: event }, myPhotoPage] = await Promise.all([
    isAssignedToEvent(context, params.eventId),
    context.supabase
      .from('events')
      .select('id, name, event_date, status')
      .eq('id', params.eventId)
      .maybeSingle(),
    listEventPhotos(context.supabase, params.eventId, { uploaderId: context.userId }),
  ])

  if (!assigned || !event) redirect('/member/events')

  const { photos: myPhotos, total: myPhotoCount, limit } = myPhotoPage

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/member/events"
        backLabel="My events"
        title={event.name}
        description={formatDate(event.event_date)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload photos</CardTitle>
          <CardDescription>
            Add your shots for this event. An admin then picks which ones go into the
            customer gallery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoUploader eventId={event.id} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="title-display text-2xl">
          Your uploads ({myPhotoCount})
        </h2>
        <PaginatedPhotoGrid
          eventId={event.id}
          photos={myPhotos}
          total={myPhotoCount}
          pageSize={limit}
          canDelete
          emptyMessage="You have not uploaded any photos to this event yet."
        />
      </section>
    </div>
  )
}
