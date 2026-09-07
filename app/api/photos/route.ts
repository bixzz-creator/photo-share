import { NextResponse, type NextRequest } from 'next/server'
import {
  MAX_FILES_PER_UPLOAD,
  RATE_LIMITS,
  SIGNED_URL_EXPIRY,
  STORAGE_BUCKET,
} from '@/lib/constants'
import { validateImageUpload } from '@/lib/file-validation'
import { badRequest, handleApiError, tooManyRequests, unauthorized, validationDetails } from '@/lib/http'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { UploadResultItem } from '@/lib/types'
import { getFileExtension } from '@/lib/utils'
import { uploadPhotosSchema } from '@/lib/validations/photo'

/** Optional `dimensions` form field: `{ "photo.jpg": { "width": 1, "height": 2 } }`. */
type Dimensions = Record<string, { width?: number; height?: number }>

function parseDimensions(raw: FormDataEntryValue | null): Dimensions {
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Dimensions) : {}
  } catch {
    return {}
  }
}

/**
 * POST /api/photos
 *
 * Multipart upload of up to MAX_FILES_PER_UPLOAD images for one event. Each
 * file is validated independently: a bad file never fails the whole batch. The
 * response is 400 only when every file failed.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized()
    }

    const limit = rateLimit(`photos:upload:${user.id}`, RATE_LIMITS.photoUpload)
    if (!limit.success) return tooManyRequests(limit.retryAfterSeconds)

    const formData = await request.formData()
    const eventId = formData.get('eventId')
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)

    const parsed = uploadPhotosSchema.safeParse({ eventId })
    if (!parsed.success) {
      return badRequest('Missing or invalid eventId', validationDetails(parsed.error))
    }
    if (files.length === 0) {
      return badRequest('No files provided')
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return badRequest(`You can upload at most ${MAX_FILES_PER_UPLOAD} files at a time`)
    }

    // Verify user is assigned to event
    const { data: membership } = await supabase
      .from('event_members')
      .select('id')
      .eq('event_id', parsed.data.eventId)
      .eq('member_id', user.id)
      .maybeSingle()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!membership && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Not assigned to this event' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const dimensions = parseDimensions(formData.get('dimensions'))
    const results: UploadResultItem[] = []

    for (const file of files) {
      // Checks the declared type, the size limit and the actual magic bytes.
      const validation = await validateImageUpload(file)
      if (!validation.ok) {
        results.push({ filename: file.name, error: validation.error })
        continue
      }

      const extension = getFileExtension(file.name) || validation.mimeType.split('/')[1]
      const storagePath = `events/${parsed.data.eventId}/${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`

      const { error: uploadError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, validation.bytes, {
          contentType: validation.mimeType,
          upsert: false,
        })

      if (uploadError) {
        console.error('[photos] storage upload failed', uploadError)
        results.push({ filename: file.name, error: 'Upload failed' })
        continue
      }

      const { data: urlData } = adminClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath)

      const { data: photo, error: dbError } = await supabase
        .from('photos')
        .insert({
          event_id: parsed.data.eventId,
          uploaded_by: user.id,
          filename: storagePath.split('/').pop(),
          original_name: file.name,
          storage_path: storagePath,
          public_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: validation.mimeType,
          width: dimensions[file.name]?.width ?? null,
          height: dimensions[file.name]?.height ?? null,
        })
        .select()
        .single()

      if (dbError || !photo) {
        // Do not leave an unreferenced object behind.
        await adminClient.storage.from(STORAGE_BUCKET).remove([storagePath])
        console.error('[photos] insert failed', dbError)
        results.push({ filename: file.name, error: 'Database error' })
        continue
      }

      const { data: signed } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY)

      results.push({
        filename: file.name,
        success: true,
        photo: { ...photo, signed_url: signed?.signedUrl ?? null },
      })
    }

    const uploaded = results.filter((result) => result.success).length

    return NextResponse.json(
      { results, uploaded, failed: results.length - uploaded },
      { status: uploaded === 0 ? 400 : 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
