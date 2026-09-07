'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, Dices, Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { GalleryCard, type GallerySummary } from '@/components/gallery/GalleryCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PIN_LENGTH } from '@/lib/constants'

const formSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(120),
  description: z.string().max(1000).optional(),
  pin: z
    .string()
    .regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), `PIN must be exactly ${PIN_LENGTH} digits`),
})

type FormValues = z.infer<typeof formSchema>

interface GalleryPublishFormProps {
  eventId: string
  eventName: string
  /**
   * Every photo flagged `is_selected` on the event. Ids rather than rows: the
   * preview grid beside this form only holds a page, but a gallery has to
   * publish the complete selection.
   */
  selectedPhotoIds: string[]
}

function randomPin() {
  const digits = new Uint8Array(PIN_LENGTH)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(digits)
  }
  return Array.from(digits, (value) => String(value % 10)).join('')
}

export function GalleryPublishForm({
  eventId,
  eventName,
  selectedPhotoIds,
}: GalleryPublishFormProps) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [published, setPublished] = useState<{ gallery: GallerySummary; pin: string } | null>(
    null
  )

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: eventName, description: '', pin: '' },
  })

  async function onSubmit(values: FormValues) {
    setFormError(null)

    const response = await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        title: values.title,
        description: values.description,
        pin: values.pin,
        photoIds: selectedPhotoIds,
      }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFormError(payload.error ?? 'Could not publish this gallery')
      return
    }

    setPublished({
      gallery: {
        ...payload.gallery,
        photoCount: selectedPhotoIds.length,
        galleryUrl: payload.galleryUrl,
      },
      pin: payload.pin,
    })
    toast.success('Gallery published')
    router.refresh()
  }

  if (published) {
    return (
      <div className="space-y-4">
        <GalleryCard gallery={published.gallery} pin={published.pin} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPublished(null)}>
            Publish another gallery
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/admin/events/${eventId}`}>Back to event</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (selectedPhotoIds.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <p>
            No photos are selected yet. Pick the shots you want the customer to see, then
            come back here to publish.
          </p>
          <Button asChild size="sm">
            <Link href={`/admin/events/${eventId}/photos`}>Review photos</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Publishing <span className="font-semibold text-foreground">{selectedPhotoIds.length}</span>{' '}
        selected photo{selectedPhotoIds.length === 1 ? '' : 's'}.
      </p>

      <div className="space-y-2">
        <Label htmlFor="title">Gallery title</Label>
        <Input id="title" aria-invalid={Boolean(errors.title)} {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Message for the customer</Label>
        <Textarea id="description" rows={3} {...register('description')} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pin">Access PIN</Label>
        <div className="flex gap-2">
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            placeholder={'0'.repeat(PIN_LENGTH)}
            className="font-mono tracking-[0.4em]"
            aria-invalid={Boolean(errors.pin)}
            {...register('pin')}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setValue('pin', randomPin(), { shouldValidate: true })}
          >
            <Dices className="h-4 w-4" />
            Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {PIN_LENGTH} digits. Stored as a bcrypt hash, so write it down before you leave
          this page.
        </p>
        {errors.pin && <p className="text-sm text-destructive">{errors.pin.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Publish gallery
      </Button>
    </form>
  )
}
