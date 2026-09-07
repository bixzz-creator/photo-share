import { z } from 'zod'
import { sanitizeText } from '@/lib/utils'

export const registerSchema = z.object({
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
    .max(72, 'Password must be 72 characters or fewer'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
