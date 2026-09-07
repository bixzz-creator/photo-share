/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { GET as galleryInfo } from '@/app/api/gallery/[gallerySlug]/route'
import { GET as galleryPhotos } from '@/app/api/gallery/[gallerySlug]/photos/route'
import { POST as verifyPin } from '@/app/api/gallery/[gallerySlug]/verify/route'
import { POST as createGallery } from '@/app/api/gallery/route'
import { GALLERY_SESSION_HEADER, MAX_PIN_ATTEMPTS } from '@/lib/constants'
import { signSessionToken } from '@/lib/gallery-session'
import { clearRateLimit } from '@/lib/rate-limit'
import { adminProfile, createSupabaseMock, memberProfile } from '../helpers/supabase-mock'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}))

const { createClient, createAdminClient } = jest.requireMock('@/lib/supabase/server') as {
  createClient: jest.Mock
  createAdminClient: jest.Mock
}

const SLUG = 'abcd1234'
const EVENT_ID = '11111111-1111-4111-8111-111111111111'
const PHOTO_ID = '22222222-2222-4222-8222-222222222222'
const CORRECT_PIN = '135790'

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.4', ...headers },
    body: JSON.stringify(body),
  })
}

function galleryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gallery-1',
    event_id: EVENT_ID,
    created_by: 'admin-1',
    title: 'Riverside Wedding',
    description: 'The best of the day',
    slug: SLUG,
    pin_hash: bcrypt.hashSync(CORRECT_PIN, 10),
    is_published: true,
    published_at: '2026-07-05T00:00:00Z',
    expires_at: null,
    view_count: 0,
    ...overrides,
  }
}

beforeEach(() => {
  clearRateLimit()
})

describe('POST /api/gallery', () => {
  const body = {
    eventId: EVENT_ID,
    title: 'Riverside Wedding',
    description: 'The best of the day',
    pin: CORRECT_PIN,
    photoIds: [PHOTO_ID],
  }

  it('lets an admin publish a gallery', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        events: { data: { id: EVENT_ID }, error: null },
        // First call checks the photos belong to the event, second flags them.
        photos: [
          { data: [{ id: PHOTO_ID }], error: null },
          { data: null, error: null },
        ],
        galleries: { data: galleryRow(), error: null },
        gallery_photos: { data: null, error: null },
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await createGallery(jsonRequest('http://localhost:3000/api/gallery', body))
    const payload = await response.json()

    expect(response.status).toBe(201)
    // The slug is derived from the title plus a short unique suffix.
    expect(payload.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)+$/)
    expect(payload.galleryUrl).toBe(`http://localhost:3000/gallery/${payload.slug}`)
    expect(payload.pin).toBe(CORRECT_PIN)
    // The hash must never leave the server.
    expect(payload.gallery.pin_hash).toBeUndefined()

    const insert = supabase.__builders('galleries')[0]?.insert
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_published: true, event_id: EVENT_ID })
    )
    const inserted = insert?.mock.calls[0]?.[0] as { pin_hash: string }
    expect(inserted.pin_hash).not.toBe(CORRECT_PIN)
    expect(await bcrypt.compare(CORRECT_PIN, inserted.pin_hash)).toBe(true)
  })

  it('stops a member from publishing a gallery', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: { profiles: { data: memberProfile(), error: null } },
      })
    )

    const response = await createGallery(jsonRequest('http://localhost:3000/api/gallery', body))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Admin only')
  })

  it('rejects photos that belong to a different event', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: {
          profiles: { data: adminProfile(), error: null },
          events: { data: { id: EVENT_ID }, error: null },
          photos: { data: [], error: null },
        },
      })
    )

    const response = await createGallery(jsonRequest('http://localhost:3000/api/gallery', body))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Some photos do not belong to this event')
  })

  it('rejects a PIN that is not 4-8 digits', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: { profiles: { data: adminProfile(), error: null } },
      })
    )

    const response = await createGallery(
      jsonRequest('http://localhost:3000/api/gallery', { ...body, pin: '12' })
    )

    expect(response.status).toBe(400)
  })
})

describe('GET /api/gallery/[gallerySlug]', () => {
  it('returns public details without the PIN hash', async () => {
    createAdminClient.mockReturnValue(
      createSupabaseMock({
        tables: {
          galleries: {
            data: {
              slug: SLUG,
              title: 'Riverside Wedding',
              description: 'The best of the day',
              is_published: true,
              expires_at: null,
              gallery_photos: [{ count: 12 }],
            },
            error: null,
          },
        },
      })
    )

    const response = await galleryInfo(
      new NextRequest(`http://localhost:3000/api/gallery/${SLUG}`),
      { params: { gallerySlug: SLUG } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ title: 'Riverside Wedding', photoCount: 12 })
    expect(payload.pin_hash).toBeUndefined()
  })

  it('returns 404 for an unpublished gallery', async () => {
    createAdminClient.mockReturnValue(
      createSupabaseMock({
        tables: {
          galleries: {
            data: { slug: SLUG, title: 'Draft', is_published: false, gallery_photos: [] },
            error: null,
          },
        },
      })
    )

    const response = await galleryInfo(
      new NextRequest(`http://localhost:3000/api/gallery/${SLUG}`),
      { params: { gallerySlug: SLUG } }
    )

    expect(response.status).toBe(404)
  })
})

describe('POST /api/gallery/[gallerySlug]/verify', () => {
  function publishedGalleryClient() {
    return createSupabaseMock({
      tables: {
        galleries: { data: galleryRow(), error: null },
        gallery_sessions: { data: null, error: null },
      },
    })
  }

  it('issues a session token for the correct PIN', async () => {
    const supabase = publishedGalleryClient()
    createAdminClient.mockReturnValue(supabase)

    const response = await verifyPin(
      jsonRequest(`http://localhost:3000/api/gallery/${SLUG}/verify`, { pin: CORRECT_PIN }),
      { params: { gallerySlug: SLUG } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.sessionToken).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/)
    expect(new Date(payload.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(response.cookies.get('gallery_session')?.value).toBe(payload.sessionToken)

    // Only the raw half of the token is stored.
    const insert = supabase.__builders('gallery_sessions')[0]?.insert
    const stored = insert?.mock.calls[0]?.[0] as { session_token: string }
    expect(payload.sessionToken.startsWith(stored.session_token)).toBe(true)
  })

  it('returns 401 with the remaining attempts for a wrong PIN', async () => {
    createAdminClient.mockReturnValue(publishedGalleryClient())

    const response = await verifyPin(
      jsonRequest(`http://localhost:3000/api/gallery/${SLUG}/verify`, { pin: '000000' }),
      { params: { gallerySlug: SLUG } }
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Invalid PIN')
    expect(payload.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS - 1)
  })

  it('locks the IP out after five wrong attempts', async () => {
    createAdminClient.mockReturnValue(publishedGalleryClient())

    const attempt = () =>
      verifyPin(
        jsonRequest(`http://localhost:3000/api/gallery/${SLUG}/verify`, { pin: '000000' }),
        { params: { gallerySlug: SLUG } }
      )

    for (let index = 0; index < MAX_PIN_ATTEMPTS; index += 1) {
      expect((await attempt()).status).toBe(401)
    }

    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    await expect(blocked.json()).resolves.toMatchObject({ attemptsRemaining: 0 })
  })

  it('returns 404 for an unpublished gallery', async () => {
    createAdminClient.mockReturnValue(
      createSupabaseMock({
        tables: { galleries: { data: galleryRow({ is_published: false }), error: null } },
      })
    )

    const response = await verifyPin(
      jsonRequest(`http://localhost:3000/api/gallery/${SLUG}/verify`, { pin: CORRECT_PIN }),
      { params: { gallerySlug: SLUG } }
    )

    expect(response.status).toBe(404)
  })
})

describe('GET /api/gallery/[gallerySlug]/photos', () => {
  const rawToken = 'a'.repeat(64)

  function activeSession(overrides: Record<string, unknown> = {}) {
    return {
      id: 'session-1',
      gallery_id: 'gallery-1',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      viewed: false,
      gallery: {
        id: 'gallery-1',
        slug: SLUG,
        title: 'Riverside Wedding',
        description: null,
        is_published: true,
        expires_at: null,
      },
      ...overrides,
    }
  }

  function photosRequest(token?: string) {
    return new NextRequest(`http://localhost:3000/api/gallery/${SLUG}/photos`, {
      headers: token ? { [GALLERY_SESSION_HEADER]: token } : undefined,
    })
  }

  it('returns signed photo URLs for a valid session', async () => {
    const supabase = createSupabaseMock({
      tables: {
        // Lookup first, then the "viewed" update.
        gallery_sessions: [
          { data: activeSession(), error: null },
          { data: null, error: null },
        ],
        gallery_photos: {
          data: [
            {
              display_order: 0,
              photo: {
                id: PHOTO_ID,
                storage_path: 'events/e/u/photo.png',
                width: 1600,
                height: 1200,
              },
            },
          ],
          error: null,
        },
      },
    })
    createAdminClient.mockReturnValue(supabase)

    const response = await galleryPhotos(photosRequest(signSessionToken(rawToken)), {
      params: { gallerySlug: SLUG },
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.photos).toHaveLength(1)
    expect(payload.photos[0]).toMatchObject({
      id: PHOTO_ID,
      url: 'https://storage.test/events/e/u/photo.png',
      width: 1600,
    })
    expect(supabase.rpc).toHaveBeenCalledWith('increment_view_count', {
      gallery_id: 'gallery-1',
    })
  })

  it('rejects a request with no session token', async () => {
    createAdminClient.mockReturnValue(createSupabaseMock())

    const response = await galleryPhotos(photosRequest(), {
      params: { gallerySlug: SLUG },
    })

    expect(response.status).toBe(401)
  })

  it('rejects a tampered session token', async () => {
    createAdminClient.mockReturnValue(createSupabaseMock())

    const response = await galleryPhotos(photosRequest(`${rawToken}.${'b'.repeat(64)}`), {
      params: { gallerySlug: SLUG },
    })
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Gallery session required')
  })

  it('rejects an expired session', async () => {
    createAdminClient.mockReturnValue(
      createSupabaseMock({
        tables: {
          gallery_sessions: {
            data: activeSession({
              expires_at: new Date(Date.now() - 1_000).toISOString(),
              viewed: true,
            }),
            error: null,
          },
        },
      })
    )

    const response = await galleryPhotos(photosRequest(signSessionToken(rawToken)), {
      params: { gallerySlug: SLUG },
    })
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Gallery session has expired')
  })
})
