'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PhotoGrid } from '@/components/photos/PhotoGrid'
import { Button } from '@/components/ui/button'
import { PHOTO_PAGE_SIZE } from '@/lib/constants'
import type { PhotoWithUploader } from '@/lib/types'

interface PaginatedPhotoGridProps {
  eventId: string
  /** First page, rendered on the server. */
  photos: PhotoWithUploader[]
  /** Photos matching the filter across the whole event. */
  total: number
  /** Restricts the request to photos flagged for the gallery. */
  selectedOnly?: boolean
  canDelete?: boolean
  emptyMessage?: string
  pageSize?: number
}

/**
 * Read-only photo grid that pulls the next page on demand. Server Components
 * render the first page so the grid is useful before any JavaScript loads;
 * everything after that comes from `/api/events/[eventId]/photos`, which scopes
 * members to their own uploads on its own.
 */
export function PaginatedPhotoGrid({
  eventId,
  photos,
  total,
  selectedOnly = false,
  canDelete = false,
  emptyMessage,
  pageSize = PHOTO_PAGE_SIZE,
}: PaginatedPhotoGridProps) {
  const [items, setItems] = useState(photos)
  const [count, setCount] = useState(total)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page + 1), limit: String(pageSize) })
      if (selectedOnly) params.set('selected', 'true')

      const response = await fetch(`/api/events/${eventId}/photos?${params}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not load more photos')
      }

      const incoming: PhotoWithUploader[] = payload.photos ?? []
      setItems((current) => {
        const seen = new Set(current.map((photo) => photo.id))
        return [...current, ...incoming.filter((photo) => !seen.has(photo.id))]
      })
      setCount(payload.total ?? count)
      setPage((current) => current + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load more photos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <PhotoGrid
        photos={items}
        canDelete={canDelete}
        onDeleted={(photoId) => {
          setItems((current) => current.filter((photo) => photo.id !== photoId))
          setCount((current) => Math.max(0, current - 1))
        }}
        emptyMessage={emptyMessage}
      />

      {items.length < count && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Load more
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {items.length} of {count}
          </p>
        </div>
      )}
    </div>
  )
}
