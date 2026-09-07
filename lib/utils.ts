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

export function absoluteUrl(path: string): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? ''
  const vercel = vercelHost ? `https://${vercelHost.replace(/^https?:\/\//, '')}` : ''
  const configuredIsLocal = !configured || /localhost|127\.0\.0\.1/.test(configured)
  const base = configuredIsLocal && vercel ? vercel : configured || vercel || 'http://localhost:3000'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Public gallery path segment from the title, e.g. "Beach wedding" →
 * `beach-wedding-k3m9`. A short suffix keeps two galleries with the same name
 * from colliding.
 */
export function gallerySlugFromTitle(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'gallery'
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `${base}-${suffix}`
}
