'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EVENT_STATUSES, type EventStatus } from '@/lib/constants'
import type { EventRecord } from '@/lib/types'
import { type CreateEventInput, createEventSchema } from '@/lib/validations/event'

interface EventFormProps {
  /** Present when editing an existing event. */
  event?: EventRecord
  onDone?: () => void
}

export function EventForm({ event, onDone }: EventFormProps) {
  const router = useRouter()
  const isEdit = Boolean(event)
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'active')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: event?.name ?? '',
      description: event?.description ?? '',
      event_date: event?.event_date ?? '',
    },
  })

  async function onSubmit(values: CreateEventInput) {
    setFormError(null)

    const response = await fetch(isEdit ? `/api/events/${event!.id}` : '/api/events', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { ...values, status } : values),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFormError(payload.error ?? 'Could not save this event')
      return
    }

    toast.success(isEdit ? 'Event updated' : 'Event created')
    router.refresh()

    if (onDone) onDone()
    else router.push(`/admin/events/${payload.event.id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          placeholder="Riverside Wedding"
          aria-invalid={Boolean(errors.name)}
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="event_date">Event date</Label>
        <Input id="event_date" type="date" {...register('event_date')} />
        {errors.event_date && (
          <p className="text-sm text-destructive">{errors.event_date.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="What is being covered, and by whom?"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as EventStatus)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create event'}
        </Button>
        {onDone && (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
