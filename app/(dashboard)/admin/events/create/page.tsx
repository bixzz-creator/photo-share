import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { EventForm } from '@/components/events/EventForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { getAuthContext } from '@/lib/auth'

export const metadata: Metadata = { title: 'Create event' }

export default async function CreateEventPage() {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref="/admin/events"
        backLabel="All events"
        title="Create event"
        description="Add the event first, then create the photographer accounts that will upload to it."
      />

      <Card>
        <CardContent className="pt-6">
          <EventForm />
        </CardContent>
      </Card>
    </div>
  )
}
