import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { EventTabs } from '@/components/events/EventTabs'
import { GalleryCard, type GallerySummary } from '@/components/gallery/GalleryCard'
import { GalleryPublishForm } from '@/components/gallery/GalleryPublishForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PaginatedPhotoGrid } from '@/components/photos/PaginatedPhotoGrid'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAuthContext } from '@/lib/auth'
import { listEventPhotoIds, listEventPhotos } from '@/lib/queries'
import { galleryShareUrl } from '@/lib/utils'

export const metadata: Metadata = { title: 'Publish gallery' }

interface PageProps {
  params: { eventId: string }
}

export default async function AdminEventGalleryPage({ params }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  const { supabase } = context

  // The preview shows one page; publishing needs every selected id, so those
  // are read separately and cheaply.
  const [{ data: event }, selectedPage, selectedPhotoIds, { data: galleryRows }] =
    await Promise.all([
      supabase.from('events').select('id, name').eq('id', params.eventId).maybeSingle(),
      listEventPhotos(supabase, params.eventId, { selectedOnly: true }),
      listEventPhotoIds(supabase, params.eventId, { selectedOnly: true }),
      supabase
        .from('galleries')
        .select(
          'id, title, description, slug, is_published, published_at, view_count, gallery_photos(count)'
        )
        .eq('event_id', params.eventId)
        .order('created_at', { ascending: false }),
    ])

  if (!event) notFound()

  const galleries: GallerySummary[] = (galleryRows ?? []).map(
    ({ gallery_photos, ...gallery }) => ({
      ...gallery,
      photoCount: (gallery_photos as { count: number }[] | null)?.[0]?.count ?? 0,
      galleryUrl: galleryShareUrl(gallery.slug),
    })
  )

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/admin/events/${event.id}`}
        backLabel={event.name}
        title="Publish gallery"
        description="Share the selected photos with the customer behind a PIN."
      />

      <EventTabs eventId={event.id} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Gallery details</CardTitle>
            <CardDescription>
              The customer opens the link, enters the PIN, and sees these photos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GalleryPublishForm
              eventId={event.id}
              eventName={event.name}
              selectedPhotoIds={selectedPhotoIds}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="eyebrow text-muted-foreground">
            Selected photos ({selectedPage.total})
          </h2>
          <PaginatedPhotoGrid
            eventId={event.id}
            photos={selectedPage.photos}
            total={selectedPage.total}
            pageSize={selectedPage.limit}
            selectedOnly
            emptyMessage="Nothing selected yet. Pick photos in the review step first."
          />
        </div>
      </div>

      {galleries.length > 0 && (
        <section className="space-y-3">
          <h2 className="title-display text-2xl">Existing galleries</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {galleries.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
