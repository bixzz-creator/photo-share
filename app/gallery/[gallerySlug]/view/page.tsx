'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { GalleryViewer } from '@/components/gallery/GalleryViewer'
import { GALLERY_SESSION_HEADER, GALLERY_SESSION_STORAGE_KEY } from '@/lib/constants'
import type { GalleryPhoto } from '@/lib/types'

interface PageProps {
  params: { gallerySlug: string }
}

interface GalleryPayload {
  gallery: { slug: string; title: string; description: string | null }
  photos: GalleryPhoto[]
}

function readToken(slug: string): string | null {
  try {
    const raw = sessionStorage.getItem(`${GALLERY_SESSION_STORAGE_KEY}:${slug}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string }
    if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) return null
    return parsed.token ?? null
  } catch {
    return null
  }
}

export default function GalleryViewPage({ params }: PageProps) {
  const router = useRouter()
  const slug = params.gallerySlug
  const [data, setData] = useState<GalleryPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const token = readToken(slug)

    // The httpOnly cookie is sent automatically; the header is used when the
    // token is also available in sessionStorage.
    fetch(`/api/gallery/${slug}/photos`, {
      headers: token ? { [GALLERY_SESSION_HEADER]: token } : undefined,
    })
      .then(async (response) => {
        if (!active) return

        if (response.status === 401) {
          sessionStorage.removeItem(`${GALLERY_SESSION_STORAGE_KEY}:${slug}`)
          router.replace(`/gallery/${slug}`)
          return
        }
        if (!response.ok) {
          router.replace(`/gallery/${slug}`)
          return
        }

        setData((await response.json()) as GalleryPayload)
        setLoading(false)
      })
      .catch(() => {
        if (active) router.replace(`/gallery/${slug}`)
      })

    return () => {
      active = false
    }
  }, [router, slug])

  if (loading || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <GalleryViewer
      slug={slug}
      title={data.gallery.title}
      description={data.gallery.description}
      photos={data.photos}
    />
  )
}
