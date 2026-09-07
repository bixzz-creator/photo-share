import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/constants'

/**
 * Magic byte prefixes. A declared `Content-Type` is attacker controlled, so the
 * real bytes decide whether an upload is accepted.
 */
const SIGNATURES: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'image/gif',
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    mime: 'image/webp',
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
]

export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null
  return SIGNATURES.find((signature) => signature.test(bytes))?.mime ?? null
}

export function isAllowedMimeType(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
}

export type FileValidationResult =
  | { ok: true; mimeType: string; bytes: Uint8Array }
  | { ok: false; error: string }

/**
 * Validates size, declared type and actual bytes in one pass, returning the
 * buffer so callers do not have to read the file twice.
 */
export async function validateImageUpload(file: File): Promise<FileValidationResult> {
  if (!isAllowedMimeType(file.type)) {
    return { ok: false, error: 'Invalid file type' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: 'File too large' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'Empty file' }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = detectImageMime(bytes)

  if (!detected) {
    return { ok: false, error: 'File content is not a supported image' }
  }
  if (detected !== file.type) {
    return { ok: false, error: 'File content does not match its type' }
  }

  return { ok: true, mimeType: detected, bytes }
}
