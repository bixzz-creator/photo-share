'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Eye, Images } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'

export interface GallerySummary {
  id: string
  title: string
  description: string | null
  slug: string
  is_published: boolean
  published_at: string | null
  view_count: number
  photoCount: number
  galleryUrl: string
}

interface GalleryCardProps {
  gallery: GallerySummary
  /** Shown only right after publishing, since the PIN is never stored. */
  pin?: string
}

export function GalleryCard({ gallery, pin }: GalleryCardProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = gallery.galleryUrl
    .replace(/https?:\/\/photo-share\.vercel\.app/gi, 'https://photo-share-lovat.vercel.app')
    .replace(/\/view\/?$/i, '')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Gallery link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1">{gallery.title}</CardTitle>
          <Badge variant={gallery.is_published ? 'success' : 'secondary'}>
            {gallery.is_published ? 'published' : 'draft'}
          </Badge>
        </div>
        {gallery.description && (
          <CardDescription className="line-clamp-2">{gallery.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Images className="h-4 w-4" />
            {gallery.photoCount} photos
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {gallery.view_count} views
          </span>
          <span>{formatDateTime(gallery.published_at)}</span>
        </div>

        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{shareUrl}</code>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 sm:h-8 sm:w-8"
            onClick={copyLink}
            aria-label="Copy gallery link"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 sm:h-8 sm:w-8" asChild>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open gallery"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        {pin && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            PIN <span className="font-mono text-sm font-semibold">{pin}</span> — copy it
            now, it is hashed and cannot be shown again.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
