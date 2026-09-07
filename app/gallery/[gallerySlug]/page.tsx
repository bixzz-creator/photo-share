'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImageOff, Loader2, Lock } from 'lucide-react'
import { PinEntry } from '@/components/gallery/PinEntry'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GALLERY_SESSION_STORAGE_KEY, PIN_LENGTH } from '@/lib/constants'
import type { PublicGalleryInfo } from '@/lib/types'

interface PageProps {
  params: { gallerySlug: string }
}

function storageKey(slug: string) {
  return `${GALLERY_SESSION_STORAGE_KEY}:${slug}`
}

export default function GalleryPinPage({ params }: PageProps) {
  const router = useRouter()
  const slug = params.gallerySlug

  const [gallery, setGallery] = useState<PublicGalleryInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useState(0)

  useEffect(() => {
    let active = true

    fetch(`/api/gallery/${slug}`)
      .then(async (response) => (response.ok ? ((await response.json()) as PublicGalleryInfo) : null))
      .then((payload) => {
        if (active) {
          setGallery(payload)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [slug])

  // Countdown while the IP is rate limited.
  useEffect(() => {
    if (lockedFor <= 0) return
    const timer = setInterval(() => setLockedFor((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [lockedFor])

  const verify = useCallback(
    async (pin: string) => {
      setSubmitting(true)
      setError(null)

      const response = await fetch(`/api/gallery/${slug}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const payload = await response.json().catch(() => ({}))
      setSubmitting(false)

      if (response.status === 429) {
        setLockedFor(payload.retryAfterSeconds ?? 3600)
        setError('Too many incorrect attempts. Please try again later.')
        return
      }

      if (!response.ok) {
        const remaining = payload.attemptsRemaining
        setError(
          typeof remaining === 'number'
            ? `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : (payload.error ?? 'Incorrect PIN.')
        )
        return
      }

      // The API also sets an httpOnly cookie; this copy lets the viewer send
      // the token explicitly.
      try {
        sessionStorage.setItem(
          storageKey(slug),
          JSON.stringify({ token: payload.sessionToken, expiresAt: payload.expiresAt })
        )
      } catch {
        // Private browsing modes can block sessionStorage; the cookie covers it.
      }

      router.push(`/gallery/${slug}/view`)
    },
    [router, slug]
  )

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (!gallery) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
        <h1 className="title-display text-3xl">Gallery not available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This link is invalid, has not been published, or has expired. Please ask your
          photographer for a new link.
        </p>
      </main>
    )
  }

  const minutes = Math.ceil(lockedFor / 60)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="title-display text-2xl">{gallery.title}</CardTitle>
            <CardDescription>
              {gallery.photoCount} photo{gallery.photoCount === 1 ? '' : 's'} waiting for
              you. Enter the {PIN_LENGTH}-digit PIN from your photographer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lockedFor > 0 ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
                Too many incorrect attempts. Try again in about {minutes} minute
                {minutes === 1 ? '' : 's'}.
              </p>
            ) : (
              <PinEntry
                onSubmit={verify}
                error={error}
                submitting={submitting}
                disabled={submitting}
              />
            )}
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" />
          Powered by Photo Sharing Platform
        </p>
      </div>
    </main>
  )
}
