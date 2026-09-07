export const STORAGE_BUCKET = 'photos'

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Mirrors the dropzone `accept` shape used by react-dropzone. */
export const DROPZONE_ACCEPT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_FILES_PER_UPLOAD = 50

/** Signed URL lifetime for photos served to browsers, in seconds. */
export const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour

export const GALLERY_SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
export const GALLERY_SESSION_HEADER = 'x-gallery-session'
export const GALLERY_SESSION_COOKIE = 'gallery_session'
export const GALLERY_SESSION_STORAGE_KEY = 'gallery-session'

export const PIN_LENGTH = 6
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8
export const MAX_PIN_ATTEMPTS = 5

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

/**
 * Photo grids page in larger chunks than lists do. Supabase caps an API
 * response at 1000 rows, so an event with more photos than this must be read
 * page by page or the tail is silently dropped.
 */
export const PHOTO_PAGE_SIZE = 60
export const SUPABASE_MAX_ROWS = 1000

export const EVENT_STATUSES = ['active', 'completed', 'archived'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const USER_ROLES = ['admin', 'member'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const RATE_LIMITS = {
  /** PIN verification: 5 attempts per IP per hour. */
  galleryPin: { limit: MAX_PIN_ATTEMPTS, windowMs: 60 * 60 * 1000 },
  /** Photo upload: 100 requests per hour per user. */
  photoUpload: { limit: 100, windowMs: 60 * 60 * 1000 },
  /** Auth endpoints: 10 attempts per IP per 15 minutes. */
  auth: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const
