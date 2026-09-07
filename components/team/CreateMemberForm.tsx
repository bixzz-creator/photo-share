'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, Check, Copy, Dices, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MemberWithAssignment } from '@/lib/types'
import { generatePassword } from '@/lib/utils'

const formSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(80, 'Full name must be 80 characters or fewer'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer'),
})

type FormValues = z.infer<typeof formSchema>

interface CreateMemberFormProps {
  eventId: string
  onCreated: (member: MemberWithAssignment) => void
  onCancel: () => void
}

interface Credentials {
  fullName: string
  email: string
  password: string
  assigned: boolean
}

/**
 * Admins create photographer accounts here rather than photographers signing
 * themselves up. The password is displayed once after creation because
 * Supabase stores only a hash of it.
 */
export function CreateMemberForm({ eventId, onCreated, onCancel }: CreateMemberFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: '', email: '', password: generatePassword() },
  })

  async function onSubmit(values: FormValues) {
    setFormError(null)

    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, eventId }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFormError(payload.error ?? 'Could not create this account')
      return
    }

    setCreated({
      fullName: values.fullName,
      email: values.email,
      password: payload.password ?? values.password,
      assigned: Boolean(payload.assigned),
    })
    onCreated({
      id: payload.member.id,
      email: values.email,
      full_name: values.fullName,
      avatar_url: null,
      isAssigned: Boolean(payload.assigned),
    })
    toast.success(`${values.fullName} can now sign in`)
  }

  async function copyCredentials() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(
        `Email: ${created.email}\nPassword: ${created.password}`
      )
      setCopied(true)
      toast.success('Credentials copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the credentials')
    }
  }

  if (created) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">{created.fullName} is ready</h3>
          <p className="text-xs text-muted-foreground">
            {created.assigned
              ? 'Assigned to this event. Send these details over — the password is not stored anywhere and cannot be shown again.'
              : 'Account created, but the assignment failed. Use the Assign button in the list below.'}
          </p>
        </div>

        <dl className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 text-muted-foreground">Email</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-xs">{created.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-muted-foreground">Password</dt>
            <dd className="min-w-0 flex-1 font-mono text-xs font-semibold">
              {created.password}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copyCredentials}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy credentials
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border bg-card p-4"
      noValidate
    >
      <div>
        <h3 className="text-sm font-semibold">Add a photographer</h3>
        <p className="text-xs text-muted-foreground">
          Creates the account and assigns it to this event. You hand the credentials to
          them; there is no sign-up page for photographers.
        </p>
      </div>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="member-name">Full name</Label>
          <Input
            id="member-name"
            placeholder="Ada Lovelace"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-email">Email</Label>
          <Input
            id="member-email"
            type="email"
            placeholder="photographer@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="member-password">Temporary password</Label>
        <div className="flex gap-2">
          <Input
            id="member-password"
            className="font-mono"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setValue('password', generatePassword(), { shouldValidate: true })
            }
          >
            <Dices className="h-4 w-4" />
            Generate
          </Button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Create account
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
