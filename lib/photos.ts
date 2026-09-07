import { SIGNED_URL_EXPIRY, STORAGE_BUCKET } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/server'
import type { Photo, PhotoWithUploader } from '@/lib/types'

type StorageClient = Pick<ReturnType<typeof createAdminClient>, 'storage'>

/**
 * The `photos` bucket is private, so browsers can only load objects through a
 * short-lived signed URL. Signing happens in bulk to keep it to one round trip.
 */
export async function signStoragePaths(
  client: StorageClient,
  paths: string[],
  expiresIn = SIGNED_URL_EXPIRY
): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return urls

  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(unique, expiresIn)

  if (error || !data) {
    console.error('[photos] failed to sign urls', error)
    return urls
  }

  data.forEach((entry) => {
    if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl)
  })

  return urls
}

type PhotoRow = Photo & {
  uploader?: { full_name: string | null } | { full_name: string | null }[] | null
}

function uploaderName(row: PhotoRow): string | null {
  const uploader = Array.isArray(row.uploader) ? row.uploader[0] : row.uploader
  return uploader?.full_name ?? null
}

/** Adds `signed_url` and a flattened `uploader_name` to raw photo rows. */
export async function withSignedUrls(
  client: StorageClient,
  rows: PhotoRow[]
): Promise<PhotoWithUploader[]> {
  const urls = await signStoragePaths(
    client,
    rows.map((row) => row.storage_path)
  )

  return rows.map((row) => {
    const { uploader: _uploader, ...photo } = row
    return {
      ...(photo as Photo),
      uploader_name: uploaderName(row),
      signed_url: urls.get(row.storage_path) ?? null,
    }
  })
}

/** Removes objects from storage, ignoring "already gone" failures. */
export async function deleteStorageObjects(client: StorageClient, paths: string[]) {
  if (paths.length === 0) return
  const { error } = await client.storage.from(STORAGE_BUCKET).remove(paths)
  if (error) console.error('[photos] failed to remove objects', error)
}
