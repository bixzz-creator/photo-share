'use client'

import { Camera } from 'lucide-react'
import { PhotoCard } from '@/components/photos/PhotoCard'
import { Card, CardContent } from '@/components/ui/card'
import type { PhotoWithUploader } from '@/lib/types'

interface PhotoGridProps {
  photos: PhotoWithUploader[]
  /** Shows a checkbox overlay on hover and reports changes via onSelect. */
  selectable?: boolean
  selectedIds?: string[]
  onSelect?: (photoId: string, selected: boolean) => void
  canDelete?: boolean
  onDeleted?: (photoId: string) => void
  onOpen?: (photoId: string) => void
  emptyMessage?: string
}

/** Responsive masonry grid: 1 column on mobile, 2 on tablet, 3 on desktop. */
export function PhotoGrid({
  photos,
  selectable = false,
  selectedIds = [],
  onSelect,
  canDelete = false,
  onDeleted,
  onOpen,
  emptyMessage = 'No photos yet.',
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Camera className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  const selected = new Set(selectedIds)

  return (
    <div className="masonry" data-testid="photo-grid">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          selectable={selectable}
          selected={selected.has(photo.id)}
          onSelect={onSelect}
          canDelete={canDelete}
          onDeleted={onDeleted}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
