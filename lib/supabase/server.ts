import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookiesToSet = { name: string; value: string; options: CookieOptions }[]

/**
 * Request-scoped client that acts as the signed-in user, so Postgres RLS
 * applies to every query.
 */
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render, where cookies are
            // read-only. The middleware refreshes the session instead.
          }
        },
      },
    }
  )
}

/**
 * Service-role client. Bypasses RLS, so callers must do their own
 * authorization first. Never import this into client code.
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
