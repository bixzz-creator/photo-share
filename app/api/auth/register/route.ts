import { NextResponse, type NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/constants'
import {
  badRequest,
  handleApiError,
  jsonError,
  tooManyRequests,
  validationDetails,
} from '@/lib/http'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/utils'
import { registerSchema } from '@/lib/validations/auth'

/**
 * POST /api/auth/register
 *
 * Public admin sign-up. The role is always `admin` regardless of the body, so
 * photographers cannot register themselves — an admin creates those accounts
 * through POST /api/members.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`auth:register:${getClientIp(request)}`, RATE_LIMITS.auth)
    if (!limit.success) return tooManyRequests(limit.retryAfterSeconds)

    const parsed = registerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { fullName, email, password } = parsed.data
    const supabase = createClient()

    // The `on_auth_user_created` trigger turns this metadata into a profile row.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'admin' },
        emailRedirectTo: absoluteUrl('/login'),
      },
    })

    if (error) {
      return jsonError(error.status && error.status < 500 ? error.status : 400, error.message)
    }

    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email, role: 'admin' } : null,
      // Supabase withholds a session until the address is confirmed.
      requiresEmailConfirmation: !data.session,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
