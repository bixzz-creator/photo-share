import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { GALLERY_SESSION_DURATION_MS, RATE_LIMITS } from '@/lib/constants'
import { generateSessionToken, galleryCookieOptions, signSessionToken } from '@/lib/gallery-session'
import {
  badRequest,
  handleApiError,
  notFound,
  serverError,
  tooManyRequests,
  validationDetails,
} from '@/lib/http'
import { clearRateLimit, getClientIp, peekRateLimit, rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/server'
import { gallerySlugSchema, verifyPinSchema } from '@/lib/validations/gallery'

interface RouteParams {
  params: { gallerySlug: string }
}

/**
 * POST /api/gallery/[gallerySlug]/verify - public.
 *
 * Exchanges a correct PIN for a 24 hour session token. Only failed attempts
 * count against the rate limit, so a customer who reopens the link is never
 * locked out.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const parsedSlug = gallerySlugSchema.safeParse(params.gallerySlug)
    if (!parsedSlug.success) return notFound('Gallery not found')

    const ip = getClientIp(request)
    const rateLimitKey = `gallery:pin:${parsedSlug.data}:${ip}`

    const current = peekRateLimit(rateLimitKey, RATE_LIMITS.galleryPin)
    if (!current.success) {
      return tooManyRequests(current.retryAfterSeconds, { attemptsRemaining: 0 })
    }

    const parsed = verifyPinSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('PIN required', validationDetails(parsed.error))
    }

    const supabase = createAdminClient()

    const { data: gallery, error } = await supabase
      .from('galleries')
      .select('id, pin_hash, is_published, title, expires_at')
      .eq('slug', parsedSlug.data)
      .maybeSingle()

    if (error) {
      console.error('[gallery] verify lookup failed', error)
      return serverError('Failed to verify PIN')
    }
    if (!gallery || !gallery.is_published) {
      return notFound('Gallery not found')
    }
    if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
      return notFound('Gallery not found')
    }

    const isValid = await bcrypt.compare(parsed.data.pin, gallery.pin_hash)
    if (!isValid) {
      const attempt = rateLimit(rateLimitKey, RATE_LIMITS.galleryPin)
      if (!attempt.success) {
        return tooManyRequests(attempt.retryAfterSeconds, { attemptsRemaining: 0 })
      }
      return NextResponse.json(
        { error: 'Invalid PIN', attemptsRemaining: attempt.remaining },
        { status: 401 }
      )
    }

    clearRateLimit(rateLimitKey)

    const rawToken = generateSessionToken()
    const expiresAtDate = new Date(Date.now() + GALLERY_SESSION_DURATION_MS)
    const expiresAt = expiresAtDate.toISOString()

    const { error: sessionError } = await supabase.from('gallery_sessions').insert({
      gallery_id: gallery.id,
      session_token: rawToken,
      ip_address: ip,
      expires_at: expiresAt,
    })

    if (sessionError) {
      console.error('[gallery] session create failed', sessionError)
      return serverError('Failed to start gallery session')
    }

    // The client keeps the HMAC-signed value; only the raw token is stored.
    const sessionToken = signSessionToken(rawToken)

    const response = NextResponse.json({
      sessionToken,
      expiresAt,
      title: gallery.title,
    })

    response.cookies.set({
      ...galleryCookieOptions(expiresAtDate),
      value: sessionToken,
    })

    return response
  } catch (error) {
    return handleApiError(error)
  }
}
