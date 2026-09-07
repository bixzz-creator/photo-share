import { z } from 'zod'
import { PHOTO_PAGE_SIZE, SUPABASE_MAX_ROWS } from '@/lib/constants'

export const uploadPhotosSchema = z.object({
  eventId: z.string().uuid('eventId must be a valid UUID'),
})

export const updatePhotoSchema = z.object({
  is_selected: z.boolean({
    required_error: 'is_selected is required',
    invalid_type_error: 'is_selected must be a boolean',
  }),
})

export const photoQuerySchema = z.object({
  selected: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(SUPABASE_MAX_ROWS).default(PHOTO_PAGE_SIZE),
})

/** Body of `POST /api/events/[eventId]/photos/select` — bulk select or clear. */
export const bulkSelectSchema = z.object({
  is_selected: z.boolean({
    required_error: 'is_selected is required',
    invalid_type_error: 'is_selected must be a boolean',
  }),
})

export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>
