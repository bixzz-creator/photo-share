'use client'

import { useEffect, useRef, useState } from 'react'
import { Download as DownloadIcon } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import Download from 'yet-another-react-lightbox/plugins/download'
import 'yet-another-react-lightbox/styles.css'
import type { GalleryPhoto } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GalleryViewerProps {
  slug: string
  title: string
  description?: string | null
  photos: GalleryPhoto[]
}

function downloadHref(slug: string, photoId: string) {
  return `/api/gallery/${slug}/download/${photoId}`
}

/** Defers the network request until the tile is close to the viewport. */
function LazyPhoto({
  slug,
  photo,
  index,
  onOpen,
}: {
  slug: string
  photo: GalleryPhoto
  index: number
  onOpen: (index: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const aspectRatio =
    photo.width && photo.height ? `${photo.width} / ${photo.height}` : '4 / 3'
  const filename = photo.originalName || `photo-${index + 1}.jpg`

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => onOpen(index)}
        aria-label={`Open photo ${index + 1}`}
        className="group relative block w-full overflow-hidden rounded-lg bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ aspectRatio }}
      >
        <span
          className={cn(
            'absolute inset-0 bg-neutral-300 transition-opacity duration-300',
            loaded ? 'opacity-0' : 'animate-pulse opacity-100'
          )}
          aria-hidden="true"
        />
        {visible && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={filename}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              'h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03]',
              loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-md'
            )}
          />
        )}
      </button>

      <a
        href={downloadHref(slug, photo.id)}
        download={filename}
        aria-label={`Download ${filename}`}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-card transition-opacity hover:bg-background"
      >
        <DownloadIcon className="h-4 w-4" />
      </a>
    </div>
  )
}

export function GalleryViewer({ slug, title, description, photos }: GalleryViewerProps) {
  const [openIndex, setOpenIndex] = useState(-1)

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 pt-[max(2rem,calc(2rem+env(safe-area-inset-top)))] text-center sm:px-6">
          <h1 className="title-display text-[2rem] sm:text-[2.8rem]">{title}</h1>
          {description && (
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {photos.length} photo{photos.length === 1 ? '' : 's'} · tap to enlarge, or
            download any shot
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {photos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No photos have been added to this gallery yet.
          </p>
        ) : (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
            data-testid="gallery-grid"
          >
            {photos.map((photo, index) => (
              <LazyPhoto
                key={photo.id}
                slug={slug}
                photo={photo}
                index={index}
                onOpen={setOpenIndex}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-white py-6 text-center text-xs text-muted-foreground">
        Powered by Photo Sharing Platform
      </footer>

      <Lightbox
        open={openIndex >= 0}
        index={Math.max(0, openIndex)}
        close={() => setOpenIndex(-1)}
        plugins={[Download]}
        slides={photos.map((photo) => ({
          src: photo.url,
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
          download: {
            url: downloadHref(slug, photo.id),
            filename: photo.originalName || 'photo.jpg',
          },
        }))}
        carousel={{ finite: photos.length <= 1 }}
      />
    </div>
  )
}
