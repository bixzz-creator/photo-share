import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ApiError } from '@/lib/http'
import type { Profile } from '@/lib/types'

type ServerClient = ReturnType<typeof createClient>

export interface AuthContext {
  supabase: ServerClient
  userId: string
  email: string
  profile: Profile
}

/**
 * React's `cache` lives in the react-server build only. Route handlers under
 * Jest load the client build, where it is missing, so fall back to calling
 * through: deduplication is an optimisation, not a correctness requirement.
 */
function perRequest<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return typeof cache === 'function' ? cache(fn) : fn
}

/**
 * Returns the signed-in user plus profile, or null when unauthenticated.
 *
 * Deduplicated per request so the dashboard layout and the page it renders
 * share one result: otherwise every navigation pays for two `getUser` calls
 * and two profile reads before any page data is even requested.
 */
export const getAuthContext = perRequest(async function (): Promise<AuthContext | null> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    supabase,
    userId: user.id,
    email: user.email ?? profile.email,
    profile: profile as Profile,
  }
})

export async function requireUser(): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!context) throw new ApiError(401, 'Unauthorized')
  return context
}

export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireUser()
  if (context.profile.role !== 'admin') throw new ApiError(403, 'Admin only')
  return context
}

export function isAdmin(context: AuthContext) {
  return context.profile.role === 'admin'
}

/** True when the member row exists for this event. */
export async function isAssignedToEvent(context: AuthContext, eventId: string) {
  const { data } = await context.supabase
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('member_id', context.userId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Admins reach every event; members only the ones they are assigned to.
 * Throws 403 rather than 404 so callers do not leak event existence.
 */
export async function requireEventAccess(context: AuthContext, eventId: string) {
  if (isAdmin(context)) return
  if (!(await isAssignedToEvent(context, eventId))) {
    throw new ApiError(403, 'Not assigned to this event')
  }
}
