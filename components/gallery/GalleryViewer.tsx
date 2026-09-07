'use client'

import { useEffect, useRef, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { GalleryPhoto } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GalleryViewerProps {
  title: string
  description?: string | null
  photos: GalleryPhoto[]
}

/** Defers the network request until the tile is close to the viewport. */
function LazyPhoto({
  photo,
  index,
  onOpen,
}: {
  photo: GalleryPhoto
  index: number
  onOpen: (index: number) => void
}) {
  const containerRef = useRef<HTMLButtonElement | null>(null)
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

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`Open photo ${index + 1}`}
      className="group relative block w-full overflow-hidden rounded-lg bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ aspectRatio }}
    >
      {/* Blurred placeholder until the full image decodes. */}
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
          alt={`Gallery photo ${index + 1}`}
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
  )
}

export function GalleryViewer({ title, description, photos }: GalleryViewerProps) {
  const [openIndex, setOpenIndex] = useState(-1)

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <h1 className="title-display text-[2.4rem] sm:text-[2.8rem]">{title}</h1>
          {description && (
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {photos.length} photo{photos.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {photos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No photos have been added to this gallery yet.
          </p>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="gallery-grid"
          >
            {photos.map((photo, index) => (
              <LazyPhoto
                key={photo.id}
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

      {/* Keyboard navigation and touch swipe come from the lightbox. */}
      <Lightbox
        open={openIndex >= 0}
        index={Math.max(0, openIndex)}
        close={() => setOpenIndex(-1)}
        slides={photos.map((photo) => ({
          src: photo.url,
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
        }))}
        carousel={{ finite: photos.length <= 1 }}
      />
    </div>
  )
}
