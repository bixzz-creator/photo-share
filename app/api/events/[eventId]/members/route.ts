import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  badRequest,
  handleApiError,
  jsonError,
  notFound,
  serverError,
  validationDetails,
} from '@/lib/http'
import type { MemberWithAssignment } from '@/lib/types'
import { addMemberSchema } from '@/lib/validations/event'

interface RouteParams {
  params: { eventId: string }
}

/**
 * GET /api/events/[eventId]/members
 * Every member account plus whether they are already on this event.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase } = await requireAdmin()

    const [{ data: profiles, error }, { data: assignments }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .eq('role', 'member')
        .order('full_name', { ascending: true }),
      supabase.from('event_members').select('member_id').eq('event_id', params.eventId),
    ])

    if (error) {
      console.error('[members] list failed', error)
      return serverError('Failed to load members')
    }

    const assigned = new Set((assignments ?? []).map((row) => row.member_id))
    const members: MemberWithAssignment[] = (profiles ?? []).map((profile) => ({
      ...profile,
      isAssigned: assigned.has(profile.id),
    }))

    return NextResponse.json({
      members,
      assignedCount: members.filter((member) => member.isAssigned).length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** POST /api/events/[eventId]/members - assign a member. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase, userId } = await requireAdmin()

    const parsed = addMemberSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', params.eventId)
      .maybeSingle()
    if (!event) return notFound('Event not found')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', parsed.data.memberId)
      .maybeSingle()

    if (!profile) return notFound('Member not found')
    if (profile.role !== 'member') {
      return badRequest('Only accounts with the member role can be assigned')
    }

    const { data: membership, error } = await supabase
      .from('event_members')
      .insert({
        event_id: params.eventId,
        member_id: parsed.data.memberId,
        added_by: userId,
      })
      .select()
      .single()

    if (error) {
      // 23505 = unique_violation on (event_id, member_id)
      if (error.code === '23505') {
        return jsonError(409, 'Member is already assigned to this event')
      }
      console.error('[members] assign failed', error)
      return serverError('Failed to assign member')
    }

    return NextResponse.json({ membership }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
