'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { CreateMemberForm } from '@/components/team/CreateMemberForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MemberWithAssignment } from '@/lib/types'

interface MemberManagerProps {
  eventId: string
  members: MemberWithAssignment[]
}

export function MemberManager({ eventId, members }: MemberManagerProps) {
  const router = useRouter()
  const [items, setItems] = useState(members)
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (member) =>
        member.full_name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term)
    )
  }, [items, query])

  const assignedCount = items.filter((member) => member.isAssigned).length

  async function toggle(member: MemberWithAssignment) {
    setPendingId(member.id)

    const response = member.isAssigned
      ? await fetch(`/api/events/${eventId}/members/${member.id}`, { method: 'DELETE' })
      : await fetch(`/api/events/${eventId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: member.id }),
        })

    setPendingId(null)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      toast.error(payload.error ?? 'Could not update this assignment')
      return
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === member.id ? { ...entry, isAssigned: !entry.isAssigned } : entry
      )
    )
    toast.success(
      member.isAssigned
        ? `${member.full_name} removed from the event`
        : `${member.full_name} added to the event`
    )
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search members"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{assignedCount}</span> assigned ·{' '}
            {items.length} member accounts
          </p>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4" />
              Add photographer
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <CreateMemberForm
          eventId={eventId}
          onCreated={(member) => {
            setItems((current) => [member, ...current.filter((entry) => entry.id !== member.id)])
            router.refresh()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  {items.length === 0
                    ? 'No photographer accounts yet. Use “Add photographer” to create one.'
                    : 'No members match that search.'}
                </TableCell>
              </TableRow>
            )}

            {filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <p className="font-medium">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={member.isAssigned ? 'success' : 'outline'}>
                    {member.isAssigned ? 'assigned' : 'not assigned'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={member.isAssigned ? 'outline' : 'default'}
                    onClick={() => toggle(member)}
                    disabled={pendingId === member.id}
                  >
                    {pendingId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : member.isAssigned ? (
                      <UserMinus className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {member.isAssigned ? 'Remove' : 'Assign'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
