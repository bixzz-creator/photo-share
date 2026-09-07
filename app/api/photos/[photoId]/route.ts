import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin, requireEventAccess, requireUser } from '@/lib/auth'
import { badRequest, forbidden, handleApiError, notFound, serverError, validationDetails } from '@/lib/http'
import { deleteStorageObjects, withSignedUrls } from '@/lib/photos'
import { createAdminClient } from '@/lib/supabase/server'
import { updatePhotoSchema } from '@/lib/validations/photo'

interface RouteParams {
  params: { photoId: string }
}

/** GET /api/photos/[photoId] - photo metadata plus a signed URL. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireUser()
    const { supabase, userId } = context

    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, uploader:profiles!photos_uploaded_by_fkey(full_name)')
      .eq('id', params.photoId)
      .maybeSingle()

    if (error) {
      console.error('[photos] detail failed', error)
      return serverError('Failed to load photo')
    }
    if (!photo) return notFound('Photo not found')

    await requireEventAccess(context, photo.event_id)
    if (!isAdmin(context) && photo.uploaded_by !== userId) {
      return forbidden('You can only view your own uploads')
    }

    const [withUrl] = await withSignedUrls(createAdminClient(), [photo])
    return NextResponse.json({ photo: withUrl })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/photos/[photoId] - admin only.
 * Toggles gallery selection.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireUser()
    const { supabase } = context

    if (!isAdmin(context)) {
      return forbidden('Only admins can select photos')
    }

    const parsed = updatePhotoSchema.safeParse(await request.json())
    if (!parsed.success) {
      return badRequest('Validation failed', validationDetails(parsed.error))
    }

    const { data: photo, error } = await supabase
      .from('photos')
      .update({ is_selected: parsed.data.is_selected })
      .eq('id', params.photoId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[photos] select failed', error)
      return serverError('Failed to update photo')
    }
    if (!photo) return notFound('Photo not found')

    return NextResponse.json({ photo })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/photos/[photoId]
 * Admins can delete any photo, members only their own uploads.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireUser()
    const { supabase, userId } = context

    const { data: photo, error } = await supabase
      .from('photos')
      .select('id, event_id, uploaded_by, storage_path')
      .eq('id', params.photoId)
      .maybeSingle()

    if (error) {
      console.error('[photos] lookup before delete failed', error)
      return serverError('Failed to delete photo')
    }
    if (!photo) return notFound('Photo not found')

    if (!isAdmin(context)) {
      await requireEventAccess(context, photo.event_id)
      if (photo.uploaded_by !== userId) {
        return forbidden('You can only delete your own uploads')
      }
    }

    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', params.photoId)

    if (deleteError) {
      console.error('[photos] delete failed', deleteError)
      return serverError('Failed to delete photo')
    }

    await deleteStorageObjects(createAdminClient(), [photo.storage_path])

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
