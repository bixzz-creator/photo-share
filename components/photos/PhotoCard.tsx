'use client'

import { useState } from 'react'
import { Check, ImageOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PhotoWithUploader } from '@/lib/types'
import { cn, formatBytes, formatDate } from '@/lib/utils'

interface PhotoCardProps {
  photo: PhotoWithUploader
  selectable?: boolean
  selected?: boolean
  onSelect?: (photoId: string, selected: boolean) => void
  canDelete?: boolean
  onDeleted?: (photoId: string) => void
  onOpen?: (photoId: string) => void
}

export function PhotoCard({
  photo,
  selectable = false,
  selected = false,
  onSelect,
  canDelete = false,
  onDeleted,
  onOpen,
}: PhotoCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function remove() {
    setDeleting(true)
    const response = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmOpen(false)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      toast.error(payload.error ?? 'Could not delete this photo')
      return
    }

    toast.success('Photo deleted')
    onDeleted?.(photo.id)
  }

  // Uploads record their pixel size, so the browser can reserve the right box
  // before the image arrives. Without it every image that loads shoves the rest
  // of the grid down, which reads as the page still loading.
  const aspectRatio =
    photo.width && photo.height ? `${photo.width} / ${photo.height}` : '4 / 3'

  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card transition-all',
        selected ? 'border-2 border-primary ring-2 ring-primary/20' : 'border-border'
      )}
      data-selected={selected ? 'true' : 'false'}
      data-testid={`photo-card-${photo.id}`}
    >
      <div className="relative bg-muted" style={{ aspectRatio }}>
        {photo.signed_url ? (
          // Signed Supabase URLs point straight at private Storage, so they skip
          // next/image optimisation.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.signed_url}
            alt={photo.original_name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              'h-full w-full object-cover transition-[transform,opacity] duration-300',
              loaded ? 'opacity-100' : 'opacity-0',
              onOpen && 'cursor-zoom-in group-hover:scale-[1.02]'
            )}
            onClick={onOpen ? () => onOpen(photo.id) : undefined}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="text-xs">Preview unavailable</span>
          </div>
        )}

        {selectable && (
          <label
            className={cn(
              'absolute left-2 top-2 flex items-center gap-2 rounded-md bg-background/90 p-1.5 shadow-sm transition-opacity',
              selected ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
            )}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => onSelect?.(photo.id, value === true)}
              aria-label={`Select ${photo.original_name}`}
            />
          </label>
        )}

        {photo.is_selected && (
          <Badge className="absolute right-2 top-2 gap-1">
            <Check className="h-3 w-3" />
            Selected
          </Badge>
        )}
      </div>

      <figcaption className="space-y-1 p-3 text-xs">
        <p className="truncate font-medium text-foreground" title={photo.original_name}>
          {photo.original_name}
        </p>
        <p className="text-muted-foreground">
          {formatBytes(photo.file_size)}
          {photo.uploader_name ? ` · ${photo.uploader_name}` : ''}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{formatDate(photo.created_at)}</span>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${photo.original_name}`}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </figcaption>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this photo?</DialogTitle>
            <DialogDescription>
              {photo.original_name} will be removed from storage. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </figure>
  )
}
