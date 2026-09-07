import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin, requireEventAccess, requireUser } from '@/lib/auth'
import { badRequest, handleApiError, serverError, validationDetails } from '@/lib/http'
import { withSignedUrls } from '@/lib/photos'
import { createAdminClient } from '@/lib/supabase/server'
import { photoQuerySchema } from '@/lib/validations/photo'

interface RouteParams {
  params: { eventId: string }
}

/**
 * GET /api/events/[eventId]/photos?selected=true&page=1&limit=60
 *
 * Admins see every photo on the event, members only their own uploads. The
 * response is always one page: an event can hold more photos than Supabase
 * will return in a single request, so `total` comes from a count rather than
 * from the length of `photos`.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireUser()
    const { supabase, userId } = context
    await requireEventAccess(context, params.eventId)

    const searchParams = request.nextUrl.searchParams
    const parsedQuery = photoQuerySchema.safeParse({
      selected: searchParams.get('selected') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return badRequest('Invalid filters', validationDetails(parsedQuery.error))
    }

    const { selected, page, limit } = parsedQuery.data
    const from = (page - 1) * limit

    let query = supabase
      .from('photos')
      .select('*, uploader:profiles!photos_uploaded_by_fkey(full_name)', { count: 'exact' })
      .eq('event_id', params.eventId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    let selectedQuery = supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId)
      .eq('is_selected', true)

    if (!isAdmin(context)) {
      query = query.eq('uploaded_by', userId)
      selectedQuery = selectedQuery.eq('uploaded_by', userId)
    }
    if (selected !== undefined) {
      query = query.eq('is_selected', selected)
    }

    const [{ data, count, error }, { count: selectedCount }] = await Promise.all([
      query,
      selectedQuery,
    ])

    if (error) {
      console.error('[photos] list failed', error)
      return serverError('Failed to load photos')
    }

    const photos = await withSignedUrls(createAdminClient(), data ?? [])
    const total = count ?? photos.length

    return NextResponse.json({
      photos,
      total,
      selectedCount: selectedCount ?? 0,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: from + photos.length < total,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
