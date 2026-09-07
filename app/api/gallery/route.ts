import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleApiError, notFound, serverError, validationDetails } from '@/lib/http'
import { galleryShareUrl, uniqueGallerySlug } from '@/lib/utils'
import { createGallerySchema } from '@/lib/validations/gallery'

/** GET /api/gallery?eventId=... - galleries for an event (admin only). */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin()
    const eventId = request.nextUrl.searchParams.get('eventId')

    let query = supabase
      .from('galleries')
      .select('id, event_id, title, description, slug, is_published, published_at, expires_at, view_count, created_at, gallery_photos(count)')
      .order('created_at', { ascending: false })

    if (eventId) query = query.eq('event_id', eventId)

    const { data, error } = await query
    if (error) {
      console.error('[gallery] list failed', error)
      return serverError('Failed to load galleries')
    }

    const galleries = (data ?? []).map(({ gallery_photos, ...gallery }) => ({
      ...gallery,
      photoCount: (gallery_photos as { count: number }[] | null)?.[0]?.count ?? 0,
      galleryUrl: galleryShareUrl(gallery.slug),
    }))

    return NextResponse.json({ galleries })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/gallery - admin only.
 * Creates a published, PIN protected gallery for the selected photos.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin()

    const parsed = createGallerySchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { eventId, title, description, pin, photoIds } = parsed.data

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle()
    if (!event) return notFound('Event not found')

    // Every photo must belong to this event, otherwise a gallery could leak
    // photos from an unrelated event.
    const { data: eventPhotos, error: photosError } = await supabase
      .from('photos')
      .select('id')
      .eq('event_id', eventId)
      .in('id', photoIds)

    if (photosError) {
      console.error('[gallery] photo check failed', photosError)
      return serverError('Failed to verify photos')
    }
    if ((eventPhotos ?? []).length !== photoIds.length) {
      return badRequest('Some photos do not belong to this event')
    }

    const pinHash = await bcrypt.hash(pin, 10)
    const slug = await uniqueGallerySlug(title, async (candidate) => {
      const { data } = await supabase.from('galleries').select('id').eq('slug', candidate).maybeSingle()
      return Boolean(data)
    })

    const { data: gallery, error } = await supabase
      .from('galleries')
      .insert({
        event_id: eventId,
        created_by: userId,
        title,
        description: description ?? null,
        slug,
        pin_hash: pinHash,
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !gallery) {
      console.error('[gallery] create failed', error)
      return serverError('Failed to create gallery')
    }

    const galleryPhotos = photoIds.map((photoId, index) => ({
      gallery_id: gallery.id,
      photo_id: photoId,
      display_order: index,
    }))

    const { error: linkError } = await supabase.from('gallery_photos').insert(galleryPhotos)
    if (linkError) {
      // Never leave a published gallery with no photos behind.
      await supabase.from('galleries').delete().eq('id', gallery.id)
      console.error('[gallery] linking photos failed', linkError)
      return serverError('Failed to attach photos to gallery')
    }

    await supabase.from('photos').update({ is_selected: true }).in('id', photoIds)

    const { pin_hash: _pinHash, ...safeGallery } = gallery

    return NextResponse.json(
      {
        gallery: safeGallery,
        galleryUrl: galleryShareUrl(slug),
        slug,
        // Returned once so the admin can pass it to the customer.
        pin,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
