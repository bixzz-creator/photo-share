'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, CalendarDays, Camera, Pencil, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EventStatus } from '@/lib/constants'
import type { EventWithCounts } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const STATUS_VARIANT: Record<EventStatus, 'success' | 'secondary' | 'outline'> = {
  active: 'success',
  completed: 'secondary',
  archived: 'outline',
}

interface EventCardProps {
  event: EventWithCounts
  /** Admin cards expose edit and archive actions. */
  canManage?: boolean
  /** Defaults to the admin or member event route. */
  href?: string
}

export function EventCard({ event, canManage = false, href }: EventCardProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const detailHref =
    href ?? (canManage ? `/admin/events/${event.id}` : `/member/events/${event.id}/upload`)

  async function archive() {
    setArchiving(true)
    const response = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
    setArchiving(false)
    setConfirmOpen(false)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      toast.error(payload.error ?? 'Could not archive this event')
      return
    }

    toast.success(`"${event.name}" archived`)
    router.refresh()
  }

  return (
    <Card className="flex h-full flex-col shadow-card transition-shadow hover:shadow-lift">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="title-display line-clamp-2 min-w-0 text-lg">
            <Link href={detailHref} className="hover:underline">
              {event.name}
            </Link>
          </CardTitle>
          <Badge variant={STATUS_VARIANT[event.status]} className="shrink-0">
            {event.status}
          </Badge>
        </div>
        {event.description && (
          <CardDescription className="line-clamp-2">{event.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-4 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {formatDate(event.event_date)}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Camera className="h-4 w-4 shrink-0" />
            <span className="tabular-nums text-foreground">{event.photo_count}</span>
            photo{event.photo_count === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            <span className="tabular-nums text-foreground">{event.member_count}</span>
            member{event.member_count === 1 ? '' : 's'}
          </span>
        </div>

        {event.selected_count > 0 && (
          <p className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <span className="tabular-nums">{event.selected_count}</span> selected for the
            gallery
          </p>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link href={detailHref}>View</Link>
        </Button>

        {canManage && (
          <>
            <Button asChild size="sm" variant="outline" aria-label="Edit event">
              <Link href={`/admin/events/${event.id}?edit=1`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            {event.status !== 'archived' && (
              <Button
                size="sm"
                variant="outline"
                aria-label="Archive event"
                onClick={() => setConfirmOpen(true)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </CardFooter>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this event?</DialogTitle>
            <DialogDescription>
              &ldquo;{event.name}&rdquo; will be hidden from active lists. Photos and
              published galleries stay available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archive} disabled={archiving}>
              {archiving ? 'Archiving...' : 'Archive event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
