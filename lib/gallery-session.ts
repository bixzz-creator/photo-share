import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import {
  GALLERY_SESSION_COOKIE,
  GALLERY_SESSION_HEADER,
} from '@/lib/constants'

function secret() {
  return process.env.GALLERY_SESSION_SECRET ?? 'insecure-development-secret'
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function sign(token: string): string {
  return crypto.createHmac('sha256', secret()).update(token).digest('hex')
}

/**
 * Tokens handed to the browser carry an HMAC so forged values are rejected
 * before touching the database. Only the raw half is stored server side.
 */
export function signSessionToken(rawToken: string): string {
  return `${rawToken}.${sign(rawToken)}`
}

export function verifySignedToken(signedToken: string | null | undefined): string | null {
  if (!signedToken) return null
  const [rawToken, signature] = signedToken.split('.')
  if (!rawToken || !signature) return null

  const expected = sign(rawToken)
  if (signature.length !== expected.length) return null
  const matches = crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expected, 'utf8')
  )
  return matches ? rawToken : null
}

/** Reads the signed token from the request header, then the cookie. */
export function getSessionTokenFromRequest(request: NextRequest | Request): string | null {
  const header = request.headers.get(GALLERY_SESSION_HEADER)
  if (header) return header

  const authorization = request.headers.get('authorization')
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GALLERY_SESSION_COOKIE}=`))

  return match ? decodeURIComponent(match.slice(GALLERY_SESSION_COOKIE.length + 1)) : null
}

export function galleryCookieOptions(expiresAt: Date) {
  return {
    name: GALLERY_SESSION_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  }
}
