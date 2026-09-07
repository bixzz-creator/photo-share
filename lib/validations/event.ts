import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, EVENT_STATUSES, MAX_PAGE_SIZE } from '@/lib/constants'
import { sanitizeText } from '@/lib/utils'

const name = z
  .string()
  .transform(sanitizeText)
  .pipe(
    z
      .string()
      .min(2, 'Event name must be at least 2 characters')
      .max(120, 'Event name must be 120 characters or fewer')
  )

const description = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().max(1000, 'Description must be 1000 characters or fewer'))
  .optional()
  .or(z.literal('').transform(() => undefined))

const eventDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format')
  .optional()
  .or(z.literal('').transform(() => undefined))

export const createEventSchema = z.object({
  name,
  description,
  event_date: eventDate,
})

export const updateEventSchema = z
  .object({
    name: name.optional(),
    description,
    event_date: eventDate,
    status: z.enum(EVENT_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  })

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export const addMemberSchema = z.object({
  memberId: z.string().uuid('memberId must be a valid UUID'),
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
