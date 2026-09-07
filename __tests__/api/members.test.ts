/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST as createMember } from '@/app/api/members/route'
import { adminProfile, createSupabaseMock, memberProfile } from '../helpers/supabase-mock'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}))

const { createClient, createAdminClient } = jest.requireMock('@/lib/supabase/server') as {
  createClient: jest.Mock
  createAdminClient: jest.Mock
}

const EVENT_ID = '11111111-1111-4111-8111-111111111111'

function createRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/members', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Admin session with the event present and the assignment insert succeeding. */
function adminClient() {
  return createSupabaseMock({
    user: { id: 'admin-1' },
    tables: {
      profiles: { data: adminProfile(), error: null },
      events: { data: { id: EVENT_ID }, error: null },
      event_members: { data: { id: 'assignment-1' }, error: null },
    },
  })
}

function serviceClient(authAdmin?: Record<string, jest.Mock>) {
  return createSupabaseMock({ authAdmin })
}

beforeEach(() => {
  createAdminClient.mockReturnValue(serviceClient())
})

describe('POST /api/members', () => {
  const validMember = {
    fullName: 'Milo Member',
    email: 'milo@example.com',
    password: 'sup3r-secret-pw',
    eventId: EVENT_ID,
  }

  it('creates a confirmed photographer account and assigns it to the event', async () => {
    const supabase = adminClient()
    const service = serviceClient()
    createClient.mockReturnValue(supabase)
    createAdminClient.mockReturnValue(service)

    const response = await createMember(createRequest(validMember))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.member.role).toBe('member')
    expect(payload.assigned).toBe(true)
    // Confirmed on creation: the admin vouches for the address, so there is no
    // confirmation email standing between the photographer and their first upload.
    expect(service.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'milo@example.com',
      password: 'sup3r-secret-pw',
      email_confirm: true,
      user_metadata: { full_name: 'Milo Member', role: 'member' },
    })
    expect(supabase.__builders('event_members')[0]?.insert).toHaveBeenCalledWith({
      event_id: EVENT_ID,
      member_id: 'created-user',
      added_by: 'admin-1',
    })
  })

  it('hands back a generated password when none is given', async () => {
    createClient.mockReturnValue(adminClient())

    const { password: _omitted, ...withoutPassword } = validMember
    const response = await createMember(createRequest(withoutPassword))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(typeof payload.password).toBe('string')
    expect(payload.password.length).toBeGreaterThanOrEqual(12)
  })

  it('never creates an admin, whatever the caller sends', async () => {
    const service = serviceClient()
    createClient.mockReturnValue(adminClient())
    createAdminClient.mockReturnValue(service)

    await createMember(createRequest({ ...validMember, role: 'admin' }))

    expect(service.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user_metadata: { full_name: 'Milo Member', role: 'member' },
      })
    )
  })

  it('reports a duplicate email as a conflict', async () => {
    createClient.mockReturnValue(adminClient())
    createAdminClient.mockReturnValue(
      serviceClient({
        createUser: jest.fn(async () => ({
          data: { user: null },
          error: { status: 422, message: 'A user with this email address has already been registered' },
        })),
      })
    )

    const response = await createMember(createRequest(validMember))
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.error).toBe('An account with that email already exists')
  })

  it('stops a member from creating accounts', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: { profiles: { data: memberProfile(), error: null } },
      })
    )

    const response = await createMember(createRequest(validMember))

    expect(response.status).toBe(403)
  })

  it('rejects an unauthenticated caller', async () => {
    createClient.mockReturnValue(createSupabaseMock({ user: null }))

    const response = await createMember(createRequest(validMember))

    expect(response.status).toBe(401)
  })

  it('404s when the event does not exist', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: {
          profiles: { data: adminProfile(), error: null },
          events: { data: null, error: null },
        },
      })
    )

    const response = await createMember(createRequest(validMember))

    expect(response.status).toBe(404)
  })

  it('validates the email address', async () => {
    createClient.mockReturnValue(adminClient())

    const response = await createMember(
      createRequest({ ...validMember, email: 'not-an-email' })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.details.email).toBeDefined()
  })

  it('rejects a password shorter than 8 characters', async () => {
    createClient.mockReturnValue(adminClient())

    const response = await createMember(createRequest({ ...validMember, password: 'short' }))

    expect(response.status).toBe(400)
  })
})
