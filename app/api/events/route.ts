import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin, requireAdmin, requireUser } from '@/lib/auth'
import { badRequest, handleApiError, serverError, validationDetails } from '@/lib/http'
import type { EventRecord, EventWithCounts, Paginated } from '@/lib/types'
import { createEventSchema, paginationSchema } from '@/lib/validations/event'

type CountRow = { count: number }
type EventRow = EventRecord & {
  photos?: CountRow[] | null
  event_members?: CountRow[] | null
}

function embeddedCount(rows?: CountRow[] | null) {
  return rows?.[0]?.count ?? 0
}

/**
 * GET /api/events
 * Admins see every event; members only the ones they are assigned to.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireUser()
    const { supabase, userId } = context

    const parsedQuery = paginationSchema.safeParse({
      page: request.nextUrl.searchParams.get('page') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return badRequest('Invalid pagination', validationDetails(parsedQuery.error))
    }

    const { page, limit } = parsedQuery.data
    const from = (page - 1) * limit

    const empty: Paginated<EventWithCounts> = {
      data: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    }

    let query = supabase
      .from('events')
      .select('*, photos(count), event_members(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (!isAdmin(context)) {
      const { data: assignments } = await supabase
        .from('event_members')
        .select('event_id')
        .eq('member_id', userId)

      const assignedIds = (assignments ?? []).map((row) => row.event_id)
      if (assignedIds.length === 0) return NextResponse.json(empty)

      query = query.in('id', assignedIds)
    }

    const { data, count, error } = await query
    if (error) {
      console.error('[events] list failed', error)
      return serverError('Failed to load events')
    }

    const rows = (data ?? []) as EventRow[]

    // Supabase cannot return a filtered embedded count, so tally the selected
    // photos for the current page in one extra query.
    const selectedByEvent = new Map<string, number>()
    if (rows.length > 0) {
      const { data: selected } = await supabase
        .from('photos')
        .select('event_id')
        .eq('is_selected', true)
        .in(
          'event_id',
          rows.map((row) => row.id)
        )

      for (const row of selected ?? []) {
        selectedByEvent.set(row.event_id, (selectedByEvent.get(row.event_id) ?? 0) + 1)
      }
    }

    const events: EventWithCounts[] = rows.map(({ photos, event_members, ...event }) => ({
      ...event,
      photo_count: embeddedCount(photos),
      member_count: embeddedCount(event_members),
      selected_count: selectedByEvent.get(event.id) ?? 0,
    }))

    const total = count ?? events.length
    return NextResponse.json({
      data: events,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    } satisfies Paginated<EventWithCounts>)
  } catch (error) {
    return handleApiError(error)
  }
}

/** POST /api/events - admin only. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin()

    const parsed = createEventSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { name, description, event_date } = parsed.data

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        name,
        description: description ?? null,
        event_date: event_date ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('[events] create failed', error)
      return serverError('Failed to create event')
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
