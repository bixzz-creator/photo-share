import { NextResponse, type NextRequest } from 'next/server'
import { STORAGE_BUCKET } from '@/lib/constants'
import { getSessionTokenFromRequest, verifySignedToken } from '@/lib/gallery-session'
import { handleApiError, notFound, serverError, unauthorized } from '@/lib/http'
import { createAdminClient } from '@/lib/supabase/server'
import { gallerySlugSchema } from '@/lib/validations/gallery'

interface RouteParams {
  params: { gallerySlug: string; photoId: string }
}

function unwrap<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function attachmentName(original: string) {
  const cleaned = original.replace(/["\\]/g, '').replace(/[/]/g, '-').trim()
  return cleaned.slice(0, 120) || 'photo.jpg'
}

/**
 * GET /api/gallery/[gallerySlug]/download/[photoId]
 *
 * Same session as the viewer. Streams the original file so the browser saves
 * it instead of opening a signed URL (which often fails across origins).
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
        'id, expires_at, gallery:galleries(id, slug, is_published, expires_at)'
      )
      .eq('session_token', rawToken)
      .maybeSingle()

    if (sessionError) {
      console.error('[gallery] download session failed', sessionError)
      return serverError('Failed to download photo')
    }
    if (!session) return unauthorized('Gallery session is invalid')
    if (new Date(session.expires_at) < new Date()) {
      return unauthorized('Gallery session has expired')
    }

    const gallery = unwrap(session.gallery as never) as {
      id: string
      slug: string
      is_published: boolean
      expires_at: string | null
    } | null

    if (!gallery || !gallery.is_published || gallery.slug !== parsedSlug.data) {
      return unauthorized('Gallery session is invalid')
    }
    if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
      return notFound('Gallery not found')
    }

    const { data: row, error } = await supabase
      .from('gallery_photos')
      .select('photo:photos(id, storage_path, original_name, mime_type)')
      .eq('gallery_id', gallery.id)
      .eq('photo_id', params.photoId)
      .maybeSingle()

    if (error) {
      console.error('[gallery] download lookup failed', error)
      return serverError('Failed to download photo')
    }

    const photo = unwrap(
      (row as { photo: { id: string; storage_path: string; original_name: string; mime_type: string | null } | null } | null)
        ?.photo ?? null
    )
    if (!photo) return notFound('Photo not found')

    const { data: file, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(photo.storage_path)

    if (downloadError || !file) {
      console.error('[gallery] storage download failed', downloadError)
      return serverError('Failed to download photo')
    }

    const filename = attachmentName(photo.original_name)
    const bytes = Buffer.from(await file.arrayBuffer())

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': photo.mime_type || file.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
