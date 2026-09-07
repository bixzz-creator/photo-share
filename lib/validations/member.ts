import { z } from 'zod'
import { sanitizeText } from '@/lib/utils'

/**
 * An admin creating a photographer's account. The password is optional: leave
 * it out and the server generates one, which is returned once so the admin can
 * pass it on.
 */
export const createMemberSchema = z.object({
  fullName: z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(2, 'Full name must be at least 2 characters')
        .max(80, 'Full name must be 80 characters or fewer')
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer')
    .optional(),
  /** Assigns the new account to this event straight away. */
  eventId: z.string().uuid('eventId must be a valid UUID').optional(),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>
