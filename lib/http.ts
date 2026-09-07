import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/** Thrown by route helpers and translated into a JSON response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json(details ? { error, details } : { error }, { status })
}

export const badRequest = (error = 'Bad request', details?: unknown) =>
  jsonError(400, error, details)
export const unauthorized = (error = 'Unauthorized') => jsonError(401, error)
export const forbidden = (error = 'Forbidden') => jsonError(403, error)
export const notFound = (error = 'Not found') => jsonError(404, error)
export const serverError = (error = 'Internal server error') => jsonError(500, error)

export function tooManyRequests(retryAfterSeconds: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: 'Too many requests', retryAfterSeconds, ...extra },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}

/** Flattens a Zod issue list into `{ field: [messages] }`. */
export function validationDetails(error: ZodError) {
  return error.flatten().fieldErrors
}

/**
 * Single exit point for route handlers. Known failures keep their status,
 * everything else becomes a 500 without leaking internals.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message, error.details)
  }
  if (error instanceof ZodError) {
    return badRequest('Validation failed', validationDetails(error))
  }
  if (error instanceof SyntaxError) {
    return badRequest('Invalid JSON body')
  }
  console.error('[api] unhandled error', error)
  return serverError()
}
