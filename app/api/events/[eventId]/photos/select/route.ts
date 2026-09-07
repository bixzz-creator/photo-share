import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleApiError, notFound, serverError, validationDetails } from '@/lib/http'
import { bulkSelectSchema } from '@/lib/validations/photo'

interface RouteParams {
  params: { eventId: string }
}

/**
 * POST /api/events/[eventId]/photos/select - admin only.
 *
 * Selects or clears every photo on the event in a single statement. The
 * per-photo route exists for individual toggles; doing a bulk change through
 * it would mean one request per photo, which an event with a few thousand
 * uploads cannot afford.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase } = await requireAdmin()

    const parsed = bulkSelectSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', params.eventId)
      .maybeSingle()
    if (!event) return notFound('Event not found')

    const { error } = await supabase
      .from('photos')
      .update({ is_selected: parsed.data.is_selected })
      .eq('event_id', params.eventId)

    if (error) {
      console.error('[photos] bulk selection failed', error)
      return serverError('Failed to update the selection')
    }

    const { count } = await supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId)
      .eq('is_selected', true)

    return NextResponse.json({ selectedCount: count ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
