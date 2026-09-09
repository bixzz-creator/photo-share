import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strips control characters and collapses whitespace. Applied to every free
 * text field that reaches the database.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : decimals)} ${units[exponent]}`
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Readable one-off password for an account an admin creates on someone's
 * behalf. The alphabet leaves out characters that are easy to confuse when a
 * password is read off a screen or written down: l, I, 1, O and 0.
 */
export function generatePassword(length = 12) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

const CANONICAL_APP_URL = 'https://photo-share-lovat.vercel.app'

function hostFromUrl(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).host
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

/**
 * The Vercel project lives at `photo-share-lovat.vercel.app` (`photo-share`
 * was already taken). Shareable customer links always use that live host.
 */
function canonicalizeAppOrigin(value: string): string {
  const host = hostFromUrl(value)
  if (/^photo-share(?:-[a-z0-9]+)?\.vercel\.app$/i.test(host)) return CANONICAL_APP_URL
  return `https://${host}`.replace(/\/$/, '')
}

export function absoluteUrl(path: string): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? ''
  const vercel = vercelHost ? canonicalizeAppOrigin(vercelHost) : ''
  const configuredIsLocal = !configured || /localhost|127\.0\.0\.1/.test(configured)
  const configuredOrigin = configuredIsLocal ? '' : canonicalizeAppOrigin(configured)
  const base =
    configuredOrigin ||
    (configuredIsLocal && vercel ? vercel : '') ||
    vercel ||
    (process.env.VERCEL ? CANONICAL_APP_URL : 'http://localhost:3000')
  const normalized = path.replace(/\/view\/?$/i, '')
  return `${base}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}

export function gallerySharePath(slug: string): string {
  return `/gallery/${slug.replace(/^\/+|\/view\/?$/gi, '')}`
}

export function galleryShareUrl(slug: string): string {
  return absoluteUrl(gallerySharePath(slug))
}

/** Title only, e.g. "Ganesh Wedding" → `ganesh-wedding`. */
export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'gallery'
  )
}

function randomSlugSuffix(length = 4): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

/**
 * Public gallery path from the title. Prefers `ganesh-wedding`; adds a short
 * suffix only when that slug is already taken.
 */
export function gallerySlugFromTitle(title: string): string {
  return `${slugifyTitle(title)}-${randomSlugSuffix(4)}`
}

export async function uniqueGallerySlug(
  title: string,
  taken: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugifyTitle(title)
  const stem = base.length >= 4 ? base : `${base}-${randomSlugSuffix(4)}`
  if (!(await taken(stem))) return stem

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `${stem}-${randomSlugSuffix(4)}`
    if (!(await taken(candidate))) return candidate
  }

  return `${stem}-${randomSlugSuffix(8)}`
}
