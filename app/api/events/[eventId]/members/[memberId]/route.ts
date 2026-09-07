import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError, notFound, serverError } from '@/lib/http'

interface RouteParams {
  params: { eventId: string; memberId: string }
}

/** DELETE /api/events/[eventId]/members/[memberId] - unassign a member. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase } = await requireAdmin()

    const { data, error } = await supabase
      .from('event_members')
      .delete()
      .eq('event_id', params.eventId)
      .eq('member_id', params.memberId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[members] unassign failed', error)
      return serverError('Failed to remove member')
    }
    if (!data) return notFound('Member is not assigned to this event')

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
