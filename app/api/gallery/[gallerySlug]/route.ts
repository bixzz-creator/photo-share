import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError, notFound, serverError } from '@/lib/http'
import { createAdminClient } from '@/lib/supabase/server'
import type { PublicGalleryInfo } from '@/lib/types'
import { gallerySlugSchema } from '@/lib/validations/gallery'

interface RouteParams {
  params: { gallerySlug: string }
}

/**
 * GET /api/gallery/[gallerySlug] - public.
 *
 * Returns just enough to render the PIN screen. Unpublished or expired
 * galleries are indistinguishable from ones that never existed.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const parsedSlug = gallerySlugSchema.safeParse(params.gallerySlug)
    if (!parsedSlug.success) return notFound('Gallery not found')

    const supabase = createAdminClient()

    const { data: gallery, error } = await supabase
      .from('galleries')
      .select('slug, title, description, is_published, expires_at, gallery_photos(count)')
      .eq('slug', parsedSlug.data)
      .maybeSingle()

    if (error) {
      console.error('[gallery] public lookup failed', error)
      return serverError('Failed to load gallery')
    }
    if (!gallery || !gallery.is_published) return notFound('Gallery not found')

    if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
      return notFound('Gallery not found')
    }

    const photoCount =
      (gallery.gallery_photos as { count: number }[] | null)?.[0]?.count ?? 0

    return NextResponse.json(
      {
        slug: gallery.slug,
        title: gallery.title,
        description: gallery.description,
        isPublished: gallery.is_published,
        photoCount,
        expiresAt: gallery.expires_at,
      } satisfies PublicGalleryInfo,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
