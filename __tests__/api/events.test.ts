/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { DELETE as deleteEvent, GET as getEvent } from '@/app/api/events/[eventId]/route'
import { GET as listEvents, POST as createEvent } from '@/app/api/events/route'
import { adminProfile, createSupabaseMock, memberProfile } from '../helpers/supabase-mock'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}))

const { createClient, createAdminClient } = jest.requireMock('@/lib/supabase/server') as {
  createClient: jest.Mock
  createAdminClient: jest.Mock
}

function jsonRequest(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    name: 'Riverside Wedding',
    description: null,
    event_date: '2026-08-01',
    created_by: 'admin-1',
    status: 'active',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

describe('POST /api/events', () => {
  it('lets an admin create an event', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        events: { data: eventRow(), error: null },
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await createEvent(
      jsonRequest('http://localhost:3000/api/events', {
        name: 'Riverside Wedding',
        event_date: '2026-08-01',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.event.name).toBe('Riverside Wedding')
    expect(supabase.__builders('events')[0]?.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Riverside Wedding', created_by: 'admin-1' })
    )
  })

  it('rejects an event created by a member', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: { profiles: { data: memberProfile(), error: null } },
      })
    )

    const response = await createEvent(
      jsonRequest('http://localhost:3000/api/events', { name: 'Sneaky event' })
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Admin only')
  })

  it('rejects an unauthenticated request', async () => {
    createClient.mockReturnValue(createSupabaseMock({ user: null }))

    const response = await createEvent(
      jsonRequest('http://localhost:3000/api/events', { name: 'Anonymous event' })
    )

    expect(response.status).toBe(401)
  })

  it('validates the event name', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: { profiles: { data: adminProfile(), error: null } },
      })
    )

    const response = await createEvent(
      jsonRequest('http://localhost:3000/api/events', { name: 'x' })
    )

    expect(response.status).toBe(400)
  })
})

describe('GET /api/events', () => {
  it('returns only the events a member is assigned to', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'member-1' },
      tables: {
        profiles: { data: memberProfile(), error: null },
        event_members: { data: [{ event_id: 'event-1' }], error: null },
        events: {
          data: [
            {
              ...eventRow(),
              photos: [{ count: 4 }],
              event_members: [{ count: 2 }],
            },
          ],
          count: 1,
          error: null,
        },
        photos: { data: [{ event_id: 'event-1' }], error: null },
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await listEvents(new NextRequest('http://localhost:3000/api/events'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(1)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({
      id: 'event-1',
      photo_count: 4,
      member_count: 2,
      selected_count: 1,
    })
    // The query is constrained to the member's assignments.
    expect(supabase.__builders('events')[0]?.in).toHaveBeenCalledWith('id', ['event-1'])
  })

  it('returns an empty page when the member has no assignments', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: {
          profiles: { data: memberProfile(), error: null },
          event_members: { data: [], error: null },
        },
      })
    )

    const response = await listEvents(new NextRequest('http://localhost:3000/api/events'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual([])
    expect(payload.total).toBe(0)
  })

  it('does not constrain the query for admins', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        events: {
          data: [{ ...eventRow(), photos: [{ count: 0 }], event_members: [{ count: 0 }] }],
          count: 1,
          error: null,
        },
        photos: { data: [], error: null },
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await listEvents(new NextRequest('http://localhost:3000/api/events'))

    expect(response.status).toBe(200)
    expect(supabase.__builders('events')[0]?.in).not.toHaveBeenCalled()
  })
})

describe('GET /api/events/[eventId]', () => {
  it('blocks a member from reading an event they are not assigned to', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: {
          profiles: { data: memberProfile(), error: null },
          event_members: { data: null, error: null },
        },
      })
    )

    const response = await getEvent(
      new NextRequest('http://localhost:3000/api/events/event-9'),
      { params: { eventId: 'event-9' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Not assigned to this event')
  })

  it('returns the event, members and stats for an admin', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: {
          profiles: { data: adminProfile(), error: null },
          events: { data: eventRow(), error: null },
          event_members: {
            data: [
              {
                id: 'assignment-1',
                added_at: '2026-07-02T00:00:00Z',
                member: {
                  id: 'member-1',
                  email: 'member@example.com',
                  full_name: 'Milo Member',
                  avatar_url: null,
                },
              },
            ],
            error: null,
          },
          photos: [
            { count: 12, data: null, error: null },
            { count: 5, data: null, error: null },
            { count: 0, data: null, error: null },
          ],
          galleries: { data: [], error: null },
        },
      })
    )

    const response = await getEvent(
      new NextRequest('http://localhost:3000/api/events/event-1'),
      { params: { eventId: 'event-1' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.event.id).toBe('event-1')
    expect(payload.members).toHaveLength(1)
    expect(payload.stats).toMatchObject({ totalPhotos: 12, selectedPhotos: 5, memberCount: 1 })
    expect(payload.canManage).toBe(true)
  })
})

describe('DELETE /api/events/[eventId]', () => {
  it('archives an event by default', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        events: { data: eventRow({ status: 'archived' }), error: null },
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await deleteEvent(
      new NextRequest('http://localhost:3000/api/events/event-1', { method: 'DELETE' }),
      { params: { eventId: 'event-1' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.archived).toBe(true)
    expect(supabase.__builders('events')[0]?.update).toHaveBeenCalledWith({ status: 'archived' })
  })

  it('permanently deletes an event and its storage objects', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        photos: { data: [{ storage_path: 'events/event-1/a.jpg' }], error: null },
        events: { data: { id: 'event-1', name: 'Riverside Wedding' }, error: null },
      },
    })
    const admin = createSupabaseMock()
    createClient.mockReturnValue(supabase)
    createAdminClient.mockReturnValue(admin)

    const response = await deleteEvent(
      new NextRequest('http://localhost:3000/api/events/event-1?permanent=true', {
        method: 'DELETE',
      }),
      { params: { eventId: 'event-1' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.deleted).toBe(true)
    expect(admin.__storage.remove).toHaveBeenCalledWith(['events/event-1/a.jpg'])
    expect(supabase.__builders('events')[0]?.delete).toHaveBeenCalled()
  })

  it('stops a member from deleting an event', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: { profiles: { data: memberProfile(), error: null } },
      })
    )

    const response = await deleteEvent(
      new NextRequest('http://localhost:3000/api/events/event-1?permanent=true', {
        method: 'DELETE',
      }),
      { params: { eventId: 'event-1' } }
    )

    expect(response.status).toBe(403)
  })
})
