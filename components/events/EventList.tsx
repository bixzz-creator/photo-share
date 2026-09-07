import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { EventCard } from '@/components/events/EventCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { EventWithCounts } from '@/lib/types'

interface EventListProps {
  events: EventWithCounts[]
  canManage?: boolean
  page?: number
  totalPages?: number
  /** Route used to build pagination links, e.g. `/admin/events`. */
  basePath?: string
  emptyMessage?: string
}

export function EventList({
  events,
  canManage = false,
  page = 1,
  totalPages = 1,
  basePath = '/admin/events',
  emptyMessage = 'No events yet.',
}: EventListProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarPlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          {canManage && (
            <Button asChild size="sm">
              <Link href="/admin/events/create">Create event</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} canManage={canManage} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={`${basePath}?page=${Math.max(1, page - 1)}`}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
              <Link href={`${basePath}?page=${Math.min(totalPages, page + 1)}`}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
