/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET as listPhotos } from '@/app/api/events/[eventId]/photos/route'
import { POST as bulkSelect } from '@/app/api/events/[eventId]/photos/select/route'
import { GET as getPhoto, PATCH as patchPhoto } from '@/app/api/photos/[photoId]/route'
import { POST as uploadPhotos } from '@/app/api/photos/route'
import { MAX_FILE_SIZE } from '@/lib/constants'
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

const EVENT_ID = '11111111-1111-4111-8111-111111111111'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** A file whose magic bytes really are a PNG. */
function pngFile(name = 'sunset.png', byteLength = 32) {
  const bytes = new Uint8Array(byteLength)
  bytes.set(PNG_SIGNATURE, 0)
  return new File([bytes], name, { type: 'image/png' })
}

function uploadRequest(files: File[], eventId: string = EVENT_ID) {
  const formData = new FormData()
  formData.append('eventId', eventId)
  files.forEach((file) => formData.append('files', file))

  return new NextRequest('http://localhost:3000/api/photos', {
    method: 'POST',
    body: formData,
  })
}

function photoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'photo-1',
    event_id: EVENT_ID,
    uploaded_by: 'member-1',
    filename: 'stored.png',
    original_name: 'sunset.png',
    storage_path: `events/${EVENT_ID}/member-1/stored.png`,
    public_url: 'https://storage.test/public.png',
    file_size: 32,
    mime_type: 'image/png',
    width: null,
    height: null,
    is_selected: false,
    metadata: {},
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

/** Assigned member: membership found, then profile, then the insert. */
function assignedMemberClient() {
  return createSupabaseMock({
    user: { id: 'member-1' },
    tables: {
      event_members: { data: { id: 'assignment-1' }, error: null },
      profiles: { data: { role: 'member' }, error: null },
      photos: { data: photoRow(), error: null },
    },
  })
}

beforeEach(() => {
  clearRateLimit()
  createAdminClient.mockReturnValue(createSupabaseMock())
})

describe('POST /api/photos', () => {
  it('accepts an upload from a member assigned to the event', async () => {
    const supabase = assignedMemberClient()
    const admin = createSupabaseMock()
    createClient.mockReturnValue(supabase)
    createAdminClient.mockReturnValue(admin)

    const response = await uploadPhotos(uploadRequest([pngFile()]))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.uploaded).toBe(1)
    expect(payload.results[0]).toMatchObject({ filename: 'sunset.png', success: true })
    expect(admin.__storage.upload).toHaveBeenCalledWith(
      expect.stringContaining(`events/${EVENT_ID}/member-1/`),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/png' })
    )
  })

  it('stores multiple files in Storage and writes metadata rows only', async () => {
    const supabase = assignedMemberClient()
    const admin = createSupabaseMock()
    createClient.mockReturnValue(supabase)
    createAdminClient.mockReturnValue(admin)

    const response = await uploadPhotos(
      uploadRequest([pngFile('ceremony.png'), pngFile('reception.png')])
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.uploaded).toBe(2)
    expect(payload.failed).toBe(0)
    expect(admin.__storage.upload).toHaveBeenCalledTimes(2)

    const inserts = supabase.__builders('photos').flatMap((builder) => builder.insert.mock.calls)
    expect(inserts).toHaveLength(2)

    for (const [row] of inserts) {
      expect(row).toEqual(
        expect.objectContaining({
          event_id: EVENT_ID,
          uploaded_by: 'member-1',
          filename: expect.any(String),
          original_name: expect.stringMatching(/\.png$/),
          storage_path: expect.stringContaining(`events/${EVENT_ID}/member-1/`),
          file_size: expect.any(Number),
        })
      )
      expect(row).not.toHaveProperty('bytes')
      expect(row).not.toHaveProperty('blob')
      expect(row).not.toHaveProperty('content')
    }
  })

  it('rejects an upload to an event the member is not assigned to', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: {
          event_members: { data: null, error: null },
          profiles: { data: { role: 'member' }, error: null },
        },
      })
    )

    const response = await uploadPhotos(uploadRequest([pngFile()]))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Not assigned to this event')
  })

  it('rejects an unauthenticated upload', async () => {
    createClient.mockReturnValue(createSupabaseMock({ user: null }))

    const response = await uploadPhotos(uploadRequest([pngFile()]))

    expect(response.status).toBe(401)
  })

  it('rejects fetching a photo with no session', async () => {
    createClient.mockReturnValue(createSupabaseMock({ user: null }))

    const response = await getPhoto(
      new NextRequest('http://localhost:3000/api/photos/photo-1'),
      { params: { photoId: 'photo-1' } }
    )

    expect(response.status).toBe(401)
  })

  it('rejects a file that is not an image', async () => {
    const supabase = assignedMemberClient()
    createClient.mockReturnValue(supabase)

    const notAnImage = new File(['plain text contents'], 'notes.txt', { type: 'text/plain' })
    const response = await uploadPhotos(uploadRequest([notAnImage]))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.results[0]).toMatchObject({
      filename: 'notes.txt',
      error: 'Invalid file type',
    })
  })

  it('rejects an image whose bytes do not match its declared type', async () => {
    createClient.mockReturnValue(assignedMemberClient())

    const disguised = new File([new Uint8Array(32)], 'fake.png', { type: 'image/png' })
    const response = await uploadPhotos(uploadRequest([disguised]))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.results[0].error).toMatch(/not a supported image/i)
  })

  it('rejects a file larger than 10MB', async () => {
    createClient.mockReturnValue(assignedMemberClient())

    // The file has to really be oversized: overriding `size` would be lost when
    // the multipart body is parsed back into a File.
    const large = pngFile('huge.png', MAX_FILE_SIZE + 1)

    const response = await uploadPhotos(uploadRequest([large]))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.results[0]).toMatchObject({ error: 'File too large' })
  })

  it('reports partial failures with a 201 when at least one file lands', async () => {
    createClient.mockReturnValue(assignedMemberClient())

    const response = await uploadPhotos(
      uploadRequest([pngFile('good.png'), new File(['x'], 'bad.txt', { type: 'text/plain' })])
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.uploaded).toBe(1)
    expect(payload.failed).toBe(1)
  })

  it('rejects a malformed event id', async () => {
    createClient.mockReturnValue(assignedMemberClient())

    const response = await uploadPhotos(uploadRequest([pngFile()], 'not-a-uuid'))

    expect(response.status).toBe(400)
  })
})

describe('PATCH /api/photos/[photoId]', () => {
  it('lets an admin select a photo for the gallery', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        photos: { data: photoRow({ is_selected: true }), error: null },
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await patchPhoto(
      new NextRequest('http://localhost:3000/api/photos/photo-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_selected: true }),
      }),
      { params: { photoId: 'photo-1' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.photo.is_selected).toBe(true)
    expect(supabase.__builders('photos')[0]?.update).toHaveBeenCalledWith({
      is_selected: true,
    })
  })

  it('stops a member from selecting photos', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: { profiles: { data: memberProfile(), error: null } },
      })
    )

    const response = await patchPhoto(
      new NextRequest('http://localhost:3000/api/photos/photo-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_selected: true }),
      }),
      { params: { photoId: 'photo-1' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Only admins can select photos')
  })

  it('validates the request body', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: { profiles: { data: adminProfile(), error: null } },
      })
    )

    const response = await patchPhoto(
      new NextRequest('http://localhost:3000/api/photos/photo-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_selected: 'yes' }),
      }),
      { params: { photoId: 'photo-1' } }
    )

    expect(response.status).toBe(400)
  })
})

describe('GET /api/events/[eventId]/photos', () => {
  function listRequest(query = '') {
    return new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/photos${query}`)
  }

  it('reports the event total, not the size of the page', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        photos: [
          { data: [photoRow()], count: 1250, error: null },
          { data: null, count: 600, error: null },
        ],
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await listPhotos(listRequest('?page=2&limit=60'), {
      params: { eventId: EVENT_ID },
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(1250)
    expect(payload.selectedCount).toBe(600)
    expect(payload.totalPages).toBe(21)
    expect(payload.hasMore).toBe(true)
    // Page 2 of 60 starts at row 60.
    expect(supabase.__builders('photos')[0]?.range).toHaveBeenCalledWith(60, 119)
  })

  it('marks the final page as having nothing more to load', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: {
          profiles: { data: adminProfile(), error: null },
          photos: [
            { data: [photoRow()], count: 1, error: null },
            { data: null, count: 0, error: null },
          ],
        },
      })
    )

    const payload = await (
      await listPhotos(listRequest(), { params: { eventId: EVENT_ID } })
    ).json()

    expect(payload.hasMore).toBe(false)
  })

  it('limits a member to their own uploads', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'member-1' },
      tables: {
        profiles: { data: memberProfile(), error: null },
        event_members: { data: { id: 'assignment-1' }, error: null },
        photos: [
          { data: [photoRow()], count: 3, error: null },
          { data: null, count: 0, error: null },
        ],
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await listPhotos(listRequest(), { params: { eventId: EVENT_ID } })

    expect(response.status).toBe(200)
    expect(supabase.__builders('photos')[0]?.eq).toHaveBeenCalledWith('uploaded_by', 'member-1')
  })

  it('refuses a member who is not on the event', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: {
          profiles: { data: memberProfile(), error: null },
          event_members: { data: null, error: null },
        },
      })
    )

    const response = await listPhotos(listRequest(), { params: { eventId: EVENT_ID } })

    expect(response.status).toBe(403)
  })

  it('rejects a page size beyond what one request can return', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'admin-1' },
        tables: { profiles: { data: adminProfile(), error: null } },
      })
    )

    const response = await listPhotos(listRequest('?limit=5000'), {
      params: { eventId: EVENT_ID },
    })

    expect(response.status).toBe(400)
  })
})

describe('POST /api/events/[eventId]/photos/select', () => {
  function selectRequest(isSelected: boolean) {
    return new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/photos/select`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_selected: isSelected }),
    })
  }

  it('selects every photo on the event in one update', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'admin-1' },
      tables: {
        profiles: { data: adminProfile(), error: null },
        events: { data: { id: EVENT_ID }, error: null },
        photos: [
          { data: null, error: null },
          { data: null, count: 1250, error: null },
        ],
      },
    })
    createClient.mockReturnValue(supabase)

    const response = await bulkSelect(selectRequest(true), { params: { eventId: EVENT_ID } })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.selectedCount).toBe(1250)
    expect(supabase.__builders('photos')[0]?.update).toHaveBeenCalledWith({ is_selected: true })
    expect(supabase.__builders('photos')[0]?.eq).toHaveBeenCalledWith('event_id', EVENT_ID)
  })

  it('stops a member from bulk selecting', async () => {
    createClient.mockReturnValue(
      createSupabaseMock({
        user: { id: 'member-1' },
        tables: { profiles: { data: memberProfile(), error: null } },
      })
    )

    const response = await bulkSelect(selectRequest(true), { params: { eventId: EVENT_ID } })

    expect(response.status).toBe(403)
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

    const response = await bulkSelect(selectRequest(false), { params: { eventId: EVENT_ID } })

    expect(response.status).toBe(404)
  })
})
