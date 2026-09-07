import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { handleApiError, unauthorized } from '@/lib/http'

// Reads the session cookie, so it can never be prerendered.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const context = await getAuthContext()
    if (!context) return unauthorized()

    const { id, email, full_name, role, avatar_url } = context.profile
    return NextResponse.json({ profile: { id, email, full_name, role, avatar_url } })
  } catch (error) {
    return handleApiError(error)
  }
}
