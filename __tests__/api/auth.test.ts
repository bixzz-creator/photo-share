/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as register } from '@/app/api/auth/register/route'
import { clearRateLimit } from '@/lib/rate-limit'
import { createSupabaseMock, memberProfile } from '../helpers/supabase-mock'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}))

const { createClient } = jest.requireMock('@/lib/supabase/server') as {
  createClient: jest.Mock
}

function postRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  })
}

const validRegistration = {
  fullName: 'Ava Administrator',
  email: 'ava@example.com',
  password: 'sup3r-secret-pw',
}

beforeEach(() => {
  clearRateLimit()
})

describe('POST /api/auth/register', () => {
  it('creates the first account as an admin', async () => {
    const supabase = createSupabaseMock({
      auth: {
        signUp: jest.fn(async () => ({
          data: {
            user: { id: 'admin-1', email: 'ava@example.com' },
            session: null,
          },
          error: null,
        })),
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await register(
      postRequest('http://localhost:3000/api/auth/register', validRegistration)
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.user).toEqual({
      id: 'admin-1',
      email: 'ava@example.com',
      role: 'admin',
    })
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ava@example.com',
        password: 'sup3r-secret-pw',
        options: expect.objectContaining({
          data: { full_name: 'Ava Administrator', role: 'admin' },
        }),
      })
    )
  })

  it('keeps creating admin accounts after the first one exists', async () => {
    const supabase = createSupabaseMock({
      auth: {
        signUp: jest.fn(async () => ({
          data: {
            user: { id: 'admin-2', email: 'ava@example.com' },
            session: null,
          },
          error: null,
        })),
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await register(
      postRequest('http://localhost:3000/api/auth/register', validRegistration)
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.user.role).toBe('admin')
    expect(supabase.auth.signUp).toHaveBeenCalled()
  })

  it('ignores a role supplied by the caller', async () => {
    const supabase = createSupabaseMock({
      auth: {
        signUp: jest.fn(async () => ({
          data: { user: { id: 'admin-1', email: 'ava@example.com' }, session: null },
          error: null,
        })),
      },
    })
    createClient.mockReturnValue(supabase)

    await register(
      postRequest('http://localhost:3000/api/auth/register', {
        ...validRegistration,
        role: 'member',
      })
    )

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { full_name: 'Ava Administrator', role: 'admin' },
        }),
      })
    )
  })

  it('rejects an invalid email address', async () => {
    createClient.mockReturnValue(createSupabaseMock())

    const response = await register(
      postRequest('http://localhost:3000/api/auth/register', {
        ...validRegistration,
        email: 'not-an-email',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.details.email).toBeDefined()
  })

  it('rejects a password shorter than 8 characters', async () => {
    createClient.mockReturnValue(createSupabaseMock())

    const response = await register(
      postRequest('http://localhost:3000/api/auth/register', {
        ...validRegistration,
        password: 'short',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.details.password).toEqual([
      'Password must be at least 8 characters',
    ])
  })

  it('rejects a name shorter than 2 characters', async () => {
    createClient.mockReturnValue(createSupabaseMock())

    const response = await register(
      postRequest('http://localhost:3000/api/auth/register', {
        ...validRegistration,
        fullName: 'A',
      })
    )

    expect(response.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('returns the profile and role based redirect for correct credentials', async () => {
    const supabase = createSupabaseMock({
      tables: { profiles: { data: memberProfile(), error: null } },
      auth: {
        signInWithPassword: jest.fn(async () => ({
          data: {
            user: { id: 'member-1', email: 'member@example.com' },
            session: { access_token: 'token' },
          },
          error: null,
        })),
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await login(
      postRequest('http://localhost:3000/api/auth/login', {
        email: 'member@example.com',
        password: 'sup3r-secret-pw',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.profile.role).toBe('member')
    expect(payload.redirectTo).toBe('/member')
  })

  it('sends admins to the admin dashboard', async () => {
    const supabase = createSupabaseMock({
      tables: { profiles: { data: { ...memberProfile('admin-1'), role: 'admin' }, error: null } },
      auth: {
        signInWithPassword: jest.fn(async () => ({
          data: { user: { id: 'admin-1', email: 'admin@example.com' }, session: {} },
          error: null,
        })),
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await login(
      postRequest('http://localhost:3000/api/auth/login', {
        email: 'admin@example.com',
        password: 'sup3r-secret-pw',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.redirectTo).toBe('/admin')
  })

  it('returns 401 for a wrong password', async () => {
    createClient.mockReturnValue(createSupabaseMock())

    const response = await login(
      postRequest('http://localhost:3000/api/auth/login', {
        email: 'member@example.com',
        password: 'wrong-password',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Invalid email or password')
  })

  it('rate limits repeated attempts from one IP', async () => {
    createClient.mockReturnValue(createSupabaseMock())

    const attempt = () =>
      login(
        postRequest('http://localhost:3000/api/auth/login', {
          email: 'member@example.com',
          password: 'wrong-password',
        })
      )

    for (let index = 0; index < 10; index += 1) {
      expect((await attempt()).status).toBe(401)
    }

    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
  })
})
