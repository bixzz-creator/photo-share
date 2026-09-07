import { z } from 'zod'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/constants'
import { sanitizeText } from '@/lib/utils'

const pin = z
  .string()
  .regex(
    new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`),
    `PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits`
  )

export const createGallerySchema = z.object({
  eventId: z.string().uuid('eventId must be a valid UUID'),
  title: z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(2, 'Title must be at least 2 characters')
        .max(120, 'Title must be 120 characters or fewer')
    ),
  description: z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().max(1000, 'Description must be 1000 characters or fewer'))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  pin,
  photoIds: z
    .array(z.string().uuid('photoIds must contain valid UUIDs'))
    .min(1, 'Select at least one photo')
    .max(500, 'A gallery can hold at most 500 photos'),
})

export const verifyPinSchema = z.object({ pin })

export const gallerySlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid gallery link')
  .min(4)
  .max(64)

export type CreateGalleryInput = z.infer<typeof createGallerySchema>
export type VerifyPinInput = z.infer<typeof verifyPinSchema>
