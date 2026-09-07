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
import { createAdminClient } from '@/lib/supabase/server'
import { generatePassword } from '@/lib/utils'
import { createMemberSchema } from '@/lib/validations/member'

/**
 * POST /api/members - admin only.
 *
 * Creates a photographer's account and hands the credentials back once, so the
 * admin can pass them on. Photographers do not sign themselves up: the address
 * is marked confirmed here because the admin is vouching for it, which also
 * means the account works immediately with no confirmation email.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin()

    const parsed = createMemberSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { fullName, email, eventId } = parsed.data
    const password = parsed.data.password ?? generatePassword()

    if (eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle()
      if (!event) return notFound('Event not found')
    }

    // The `on_auth_user_created` trigger turns this metadata into a profile row.
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'member' },
    })

    if (error || !data?.user) {
      if (error?.status === 422 || /already/i.test(error?.message ?? '')) {
        return jsonError(409, 'An account with that email already exists')
      }
      console.error('[members] create failed', error)
      return serverError('Failed to create the account')
    }

    let assigned = false
    if (eventId) {
      const { error: assignError } = await supabase.from('event_members').insert({
        event_id: eventId,
        member_id: data.user.id,
        added_by: userId,
      })

      // 23505 = already on the event, which is not a failure worth reporting.
      if (assignError && assignError.code !== '23505') {
        console.error('[members] assign after create failed', assignError)
      } else {
        assigned = true
      }
    }

    return NextResponse.json(
      {
        member: { id: data.user.id, email, full_name: fullName, role: 'member' },
        // Shown once. Supabase stores only a hash, so it cannot be read back.
        password,
        assigned,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
