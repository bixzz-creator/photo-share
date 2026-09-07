import { NextResponse, type NextRequest } from 'next/server'
import { SIGNED_URL_EXPIRY } from '@/lib/constants'
import { getSessionTokenFromRequest, verifySignedToken } from '@/lib/gallery-session'
import { handleApiError, notFound, serverError, unauthorized } from '@/lib/http'
import { signStoragePaths } from '@/lib/photos'
import { createAdminClient } from '@/lib/supabase/server'
import type { GalleryPhoto } from '@/lib/types'
import { gallerySlugSchema } from '@/lib/validations/gallery'

interface RouteParams {
  params: { gallerySlug: string }
}

interface EmbeddedPhoto {
  id: string
  storage_path: string
  original_name: string
  mime_type: string | null
  width: number | null
  height: number | null
}

interface GalleryPhotoRow {
  display_order: number
  photo: EmbeddedPhoto | EmbeddedPhoto[] | null
}

/** Supabase types embedded rows as either an object or an array. */
function unwrap<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

/**
 * GET /api/gallery/[gallerySlug]/photos
 *
 * Requires the session token issued by the verify endpoint (header
 * `x-gallery-session` or the httpOnly cookie). Photos come back as signed URLs
 * that expire in one hour.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const parsedSlug = gallerySlugSchema.safeParse(params.gallerySlug)
    if (!parsedSlug.success) return notFound('Gallery not found')

    const rawToken = verifySignedToken(getSessionTokenFromRequest(request))
    if (!rawToken) return unauthorized('Gallery session required')

    const supabase = createAdminClient()

    const { data: session, error: sessionError } = await supabase
      .from('gallery_sessions')
      .select(
        'id, gallery_id, expires_at, viewed, gallery:galleries(id, slug, title, description, is_published, expires_at)'
      )
      .eq('session_token', rawToken)
      .maybeSingle()

    if (sessionError) {
      console.error('[gallery] session lookup failed', sessionError)
      return serverError('Failed to load gallery')
    }
    if (!session) return unauthorized('Gallery session is invalid')
    if (new Date(session.expires_at) < new Date()) {
      return unauthorized('Gallery session has expired')
    }

    const gallery = unwrap(session.gallery as never) as {
      id: string
      slug: string
      title: string
      description: string | null
      is_published: boolean
      expires_at: string | null
    } | null

    // A token is only valid for the gallery it was issued for.
    if (!gallery || !gallery.is_published || gallery.slug !== parsedSlug.data) {
      return unauthorized('Gallery session is invalid')
    }
    if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
      return notFound('Gallery not found')
    }

    const { data: rows, error } = await supabase
      .from('gallery_photos')
      .select('display_order, photo:photos(id, storage_path, original_name, mime_type, width, height)')
      .eq('gallery_id', gallery.id)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[gallery] photo list failed', error)
      return serverError('Failed to load gallery photos')
    }

    const entries = ((rows ?? []) as unknown as GalleryPhotoRow[]).flatMap((row) => {
      const photo = unwrap(row.photo)
      return photo ? [{ displayOrder: row.display_order, photo }] : []
    })

    const signed = await signStoragePaths(
      supabase,
      entries.map((entry) => entry.photo.storage_path),
      SIGNED_URL_EXPIRY
    )

    const photos: GalleryPhoto[] = entries.flatMap(({ displayOrder, photo }) => {
      const url = signed.get(photo.storage_path)
      return url
        ? [
            {
              id: photo.id,
              url,
              width: photo.width,
              height: photo.height,
              displayOrder,
              originalName: photo.original_name,
            },
          ]
        : []
    })

    // Count one view the first time a session actually opens the gallery.
    if (!session.viewed) {
      await Promise.all([
        supabase.from('gallery_sessions').update({ viewed: true }).eq('id', session.id),
        supabase.rpc('increment_view_count', { gallery_id: gallery.id }),
      ])
    }

    return NextResponse.json(
      {
        gallery: {
          slug: gallery.slug,
          title: gallery.title,
          description: gallery.description,
        },
        photos,
        total: photos.length,
        expiresIn: SIGNED_URL_EXPIRY,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
