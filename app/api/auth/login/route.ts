import { NextResponse, type NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/constants'
import { badRequest, handleApiError, jsonError, tooManyRequests, validationDetails } from '@/lib/http'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`auth:login:${getClientIp(request)}`, RATE_LIMITS.auth)
    if (!limit.success) return tooManyRequests(limit.retryAfterSeconds)

    const parsed = loginSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

    // Deliberately vague: do not reveal whether the address exists.
    if (error || !data.user) {
      return jsonError(401, 'Invalid email or password')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .single()

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      profile,
      redirectTo: profile?.role === 'admin' ? '/admin' : '/member',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
