import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin, requireAdmin, requireEventAccess, requireUser } from '@/lib/auth'
import { SUPABASE_MAX_ROWS } from '@/lib/constants'
import { badRequest, handleApiError, notFound, serverError, validationDetails } from '@/lib/http'
import { deleteStorageObjects } from '@/lib/photos'
import { createAdminClient } from '@/lib/supabase/server'
import { updateEventSchema } from '@/lib/validations/event'

interface RouteParams {
  params: { eventId: string }
}

/** GET /api/events/[eventId] - event, members and photo stats. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireUser()
    const { supabase, userId } = context
    await requireEventAccess(context, params.eventId)

    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', params.eventId)
      .maybeSingle()

    if (error) {
      console.error('[events] detail failed', error)
      return serverError('Failed to load event')
    }
    if (!event) return notFound('Event not found')

    const { data: members } = await supabase
      .from('event_members')
      .select('id, added_at, member:profiles!event_members_member_id_fkey(id, email, full_name, avatar_url)')
      .eq('event_id', params.eventId)
      .order('added_at', { ascending: true })

    const [{ count: totalPhotos }, { count: selectedPhotos }, { count: myPhotos }] =
      await Promise.all([
        supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', params.eventId),
        supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', params.eventId)
          .eq('is_selected', true),
        supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', params.eventId)
          .eq('uploaded_by', userId),
      ])

    const { data: galleries } = await supabase
      .from('galleries')
      .select('id, title, slug, is_published, published_at, view_count')
      .eq('event_id', params.eventId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      event,
      members: members ?? [],
      galleries: galleries ?? [],
      stats: {
        totalPhotos: totalPhotos ?? 0,
        selectedPhotos: selectedPhotos ?? 0,
        myPhotos: myPhotos ?? 0,
        memberCount: members?.length ?? 0,
      },
      canManage: isAdmin(context),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** PUT /api/events/[eventId] - admin only. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase } = await requireAdmin()

    const parsed = updateEventSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    )

    const { data: event, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', params.eventId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[events] update failed', error)
      return serverError('Failed to update event')
    }
    if (!event) return notFound('Event not found')

    return NextResponse.json({ event })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/events/[eventId] - admin only.
 *
 * Default is a soft archive so photos and galleries stay intact.
 * `?permanent=true` removes the event, its photos, galleries, and storage objects.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase } = await requireAdmin()
    const permanent = request.nextUrl.searchParams.get('permanent') === 'true'

    if (!permanent) {
      const { data: event, error } = await supabase
        .from('events')
        .update({ status: 'archived' })
        .eq('id', params.eventId)
        .select()
        .maybeSingle()

      if (error) {
        console.error('[events] archive failed', error)
        return serverError('Failed to archive event')
      }
      if (!event) return notFound('Event not found')

      return NextResponse.json({ event, archived: true })
    }

    const paths: string[] = []
    let from = 0

    for (;;) {
      const { data, error } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('event_id', params.eventId)
        .range(from, from + SUPABASE_MAX_ROWS - 1)

      if (error) {
        console.error('[events] photo paths failed', error)
        return serverError('Failed to delete event photos')
      }

      const batch = (data ?? [])
        .map((row) => row.storage_path)
        .filter((path): path is string => Boolean(path))
      paths.push(...batch)

      if (batch.length < SUPABASE_MAX_ROWS) break
      from += SUPABASE_MAX_ROWS
    }

    await deleteStorageObjects(createAdminClient(), paths)

    const { data: event, error } = await supabase
      .from('events')
      .delete()
      .eq('id', params.eventId)
      .select('id, name')
      .maybeSingle()

    if (error) {
      console.error('[events] delete failed', error)
      return serverError('Failed to delete event')
    }
    if (!event) return notFound('Event not found')

    return NextResponse.json({ deleted: true, event })
  } catch (error) {
    return handleApiError(error)
  }
}
