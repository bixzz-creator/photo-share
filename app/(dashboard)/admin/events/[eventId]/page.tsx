import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Camera, CheckCircle2, Share2, Users } from 'lucide-react'
import { EventForm } from '@/components/events/EventForm'
import { EventTabs } from '@/components/events/EventTabs'
import { GalleryCard, type GallerySummary } from '@/components/gallery/GalleryCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/layout/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAuthContext } from '@/lib/auth'
import type { EventRecord } from '@/lib/types'
import { absoluteUrl, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Event' }

interface PageProps {
  params: { eventId: string }
  searchParams: { edit?: string }
}

export default async function AdminEventDetailPage({ params, searchParams }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  const { supabase } = context

  // All five reads go out together: waiting for the event row first would add a
  // whole round trip to a page that is otherwise one round trip deep.
  const [
    { data: event },
    { count: totalPhotos },
    { count: selectedPhotos },
    { count: memberCount },
    { data: galleryRows },
  ] = await Promise.all([
    supabase.from('events').select('*').eq('id', params.eventId).maybeSingle(),
    supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId),
    supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId)
      .eq('is_selected', true),
    supabase
      .from('event_members')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId),
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
      galleryUrl: absoluteUrl(`/gallery/${gallery.slug}`),
    })
  )

  const isEditing = searchParams.edit === '1'
  const stats = [
    { label: 'Photos', value: totalPhotos ?? 0, icon: Camera, hint: 'uploaded by the team' },
    {
      label: 'Selected',
      value: selectedPhotos ?? 0,
      icon: CheckCircle2,
      hint: 'ready for the customer',
    },
    { label: 'Team', value: memberCount ?? 0, icon: Users, hint: 'photographers assigned' },
    { label: 'Galleries', value: galleries.length, icon: Share2, hint: 'published so far' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/admin/events"
        backLabel="All events"
        title={event.name}
        badge={
          <Badge variant={event.status === 'active' ? 'success' : 'secondary'}>
            {event.status}
          </Badge>
        }
        description={
          <>
            <span>{formatDate(event.event_date)}</span>
            {event.description && <p className="mt-1">{event.description}</p>}
          </>
        }
        actions={
          <Button asChild>
            <Link href={`/admin/events/${event.id}/gallery`}>
              <Share2 className="h-4 w-4" />
              Publish gallery
            </Link>
          </Button>
        }
      />

      <EventTabs eventId={event.id} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            emphasis={stat.label === 'Selected'}
            hint={stat.hint}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Event details</CardTitle>
            <CardDescription>
              {isEditing
                ? 'Update the event name, date, description or status.'
                : 'Edit the event to change its name, date or status.'}
            </CardDescription>
          </div>
          <Button asChild variant={isEditing ? 'ghost' : 'outline'} size="sm">
            <Link
              href={
                isEditing ? `/admin/events/${event.id}` : `/admin/events/${event.id}?edit=1`
              }
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Link>
          </Button>
        </CardHeader>
        {isEditing && (
          <CardContent>
            <EventForm event={event as EventRecord} />
          </CardContent>
        )}
      </Card>

      <section className="space-y-4">
        <h2 className="title-display text-2xl">Galleries</h2>
        {galleries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Share2 className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">No gallery published yet</p>
                <p className="text-sm text-muted-foreground">
                  Select the photos you want the customer to see, then publish a gallery
                  with a link and PIN.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/events/${event.id}/photos`}>Review photos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {galleries.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
