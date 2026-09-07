import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { EventTabs } from '@/components/events/EventTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberManager } from '@/components/team/MemberManager'
import { getAuthContext } from '@/lib/auth'
import { listMembersForEvent } from '@/lib/queries'

export const metadata: Metadata = { title: 'Team members' }

interface PageProps {
  params: { eventId: string }
}

export default async function AdminEventMembersPage({ params }: PageProps) {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  if (context.profile.role !== 'admin') redirect('/member')

  const [{ data: event }, members] = await Promise.all([
    context.supabase.from('events').select('id, name').eq('id', params.eventId).maybeSingle(),
    listMembersForEvent(context.supabase, params.eventId),
  ])

  if (!event) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/admin/events/${event.id}`}
        backLabel={event.name}
        title="Team"
        description="Create photographer accounts and choose who can upload to this event. Only assigned photographers can add photos."
      />

      <EventTabs eventId={event.id} />

      <MemberManager eventId={event.id} members={members} />
    </div>
  )
}
