'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCheck, ChevronDown, Loader2, Share2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PhotoGrid } from '@/components/photos/PhotoGrid'
import { Button } from '@/components/ui/button'
import { PHOTO_PAGE_SIZE } from '@/lib/constants'
import type { PhotoWithUploader } from '@/lib/types'

interface PhotoSelectorProps {
  eventId: string
  /** First page of photos, newest first. */
  photos: PhotoWithUploader[]
  /** Photos on the event, which is more than the page above once it fills up. */
  total?: number
  /** Photos already flagged for the gallery, counted across the whole event. */
  selectedCount?: number
  pageSize?: number
}

/**
 * Admin photo review. Selection is persisted straight away through
 * `PATCH /api/photos/[photoId]`, so the publish step can simply read the
 * photos flagged `is_selected`.
 *
 * The grid loads a page at a time. Counts come from the server rather than
 * from the loaded photos, so they stay honest while most of the event is still
 * unloaded, and the bulk buttons act on every photo rather than the visible ones.
 */
export function PhotoSelector({
  eventId,
  photos,
  total: initialTotal,
  selectedCount: initialSelectedCount,
  pageSize = PHOTO_PAGE_SIZE,
}: PhotoSelectorProps) {
  const router = useRouter()
  const [items, setItems] = useState(photos)
  const [total, setTotal] = useState(initialTotal ?? photos.length)
  const [selectedCount, setSelectedCount] = useState(
    initialSelectedCount ?? photos.filter((photo) => photo.is_selected).length
  )
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const selectedIds = items.filter((photo) => photo.is_selected).map((photo) => photo.id)
  const hasMore = items.length < total

  async function persist(photoId: string, isSelected: boolean) {
    const response = await fetch(`/api/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_selected: isSelected }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error ?? 'Could not update the selection')
    }
  }

  function applySelection(photoId: string, isSelected: boolean) {
    setItems((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, is_selected: isSelected } : photo
      )
    )
    setSelectedCount((current) => Math.max(0, current + (isSelected ? 1 : -1)))
  }

  async function toggle(photoId: string, isSelected: boolean) {
    // Optimistic: revert the single photo if the request fails.
    applySelection(photoId, isSelected)

    try {
      await persist(photoId, isSelected)
    } catch (error) {
      applySelection(photoId, !isSelected)
      toast.error(error instanceof Error ? error.message : 'Could not update the selection')
    }
  }

  async function setAll(isSelected: boolean) {
    setBusy(true)
    try {
      const response = await fetch(`/api/events/${eventId}/photos/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_selected: isSelected }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not update the selection')
      }

      setItems((current) => current.map((photo) => ({ ...photo, is_selected: isSelected })))
      setSelectedCount(payload.selectedCount ?? (isSelected ? total : 0))
      toast.success(isSelected ? 'All photos selected' : 'Selection cleared')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the selection')
    } finally {
      setBusy(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const response = await fetch(
        `/api/events/${eventId}/photos?page=${page + 1}&limit=${pageSize}`
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not load more photos')
      }

      const incoming: PhotoWithUploader[] = payload.photos ?? []
      // Guard against duplicates if a photo was added while paging.
      setItems((current) => {
        const seen = new Set(current.map((photo) => photo.id))
        return [...current, ...incoming.filter((photo) => !seen.has(photo.id))]
      })
      setTotal(payload.total ?? total)
      setSelectedCount(payload.selectedCount ?? selectedCount)
      setPage((current) => current + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load more photos')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <p className="text-sm">
          <span className="font-semibold" data-testid="selected-count">
            {selectedCount}
          </span>{' '}
          of {total} photos selected for the gallery
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll(true)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Select all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll(false)} disabled={busy}>
            <XCircle className="h-4 w-4" />
            Clear
          </Button>
          <Button asChild size="sm" disabled={selectedCount === 0}>
            <Link href={`/admin/events/${eventId}/gallery`}>
              <Share2 className="h-4 w-4" />
              Publish gallery
            </Link>
          </Button>
        </div>
      </div>

      <PhotoGrid
        photos={items}
        selectable
        selectedIds={selectedIds}
        onSelect={toggle}
        canDelete
        onDeleted={(photoId) => {
          setItems((current) => current.filter((photo) => photo.id !== photoId))
          setTotal((current) => Math.max(0, current - 1))
          router.refresh()
        }}
        emptyMessage="No photos have been uploaded to this event yet."
      />

      {hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Load more
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {items.length} of {total}
          </p>
        </div>
      )}
    </div>
  )
}
