import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoSelector } from '@/components/photos/PhotoSelector'
import type { PhotoWithUploader } from '@/lib/types'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}))

const EVENT_ID = '11111111-1111-4111-8111-111111111111'

function photo(id: string, overrides: Partial<PhotoWithUploader> = {}): PhotoWithUploader {
  return {
    id,
    event_id: EVENT_ID,
    uploaded_by: 'member-1',
    filename: `${id}.png`,
    original_name: `${id}.png`,
    storage_path: `events/${EVENT_ID}/member-1/${id}.png`,
    public_url: 'https://storage.test/public.png',
    file_size: 2048,
    mime_type: 'image/png',
    width: 1600,
    height: 1200,
    is_selected: false,
    metadata: {},
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    uploader_name: 'Milo Member',
    signed_url: `https://storage.test/${id}.png`,
    ...overrides,
  }
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('PhotoSelector', () => {
  it('reports how many photos are selected', () => {
    render(
      <PhotoSelector
        eventId={EVENT_ID}
        photos={[photo('a'), photo('b', { is_selected: true })]}
      />
    )

    expect(screen.getByText(/of 2 photos selected for the gallery/i)).toBeInTheDocument()
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
  })

  it('persists a selection through the photos API', async () => {
    const user = userEvent.setup()
    render(<PhotoSelector eventId={EVENT_ID} photos={[photo('a')]} />)

    await user.click(screen.getByRole('checkbox', { name: 'Select a.png' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/photos/a', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_selected: true }),
      })
    })
    expect(screen.getByTestId('photo-card-a')).toHaveAttribute('data-selected', 'true')
  })

  it('deselects a photo that was already selected', async () => {
    const user = userEvent.setup()
    render(<PhotoSelector eventId={EVENT_ID} photos={[photo('a', { is_selected: true })]} />)

    await user.click(screen.getByRole('checkbox', { name: 'Select a.png' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/photos/a',
        expect.objectContaining({ body: JSON.stringify({ is_selected: false }) })
      )
    })
  })

  it('rolls the selection back when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Admin only' }) })
    const user = userEvent.setup()
    render(<PhotoSelector eventId={EVENT_ID} photos={[photo('a')]} />)

    await user.click(screen.getByRole('checkbox', { name: 'Select a.png' }))

    await waitFor(() => {
      expect(screen.getByTestId('photo-card-a')).toHaveAttribute('data-selected', 'false')
    })
  })

  it('selects every photo on the event in one request', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ selectedCount: 3 }) })
    const user = userEvent.setup()
    render(
      <PhotoSelector
        eventId={EVENT_ID}
        photos={[photo('a'), photo('b'), photo('c', { is_selected: true })]}
      />
    )

    await user.click(screen.getByRole('button', { name: /select all/i }))

    // One bulk call, not one per photo: the event may hold thousands.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(fetchMock).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/photos/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_selected: true }),
    })
    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('3')
    })
  })

  it('counts the whole event, not just the loaded page', () => {
    render(
      <PhotoSelector
        eventId={EVENT_ID}
        photos={[photo('a'), photo('b')]}
        total={1250}
        selectedCount={600}
      />
    )

    expect(screen.getByTestId('selected-count')).toHaveTextContent('600')
    expect(screen.getByText(/of 1250 photos selected for the gallery/i)).toBeInTheDocument()
    expect(screen.getByText(/showing 2 of 1250/i)).toBeInTheDocument()
  })

  it('appends the next page when Load more is clicked', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [photo('c'), photo('d')], total: 4, selectedCount: 0 }),
    })
    const user = userEvent.setup()
    render(
      <PhotoSelector
        eventId={EVENT_ID}
        photos={[photo('a'), photo('b')]}
        total={4}
        selectedCount={0}
        pageSize={2}
      />
    )

    await user.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() => {
      expect(screen.getByTestId('photo-card-c')).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/events/${EVENT_ID}/photos?page=2&limit=2`
    )
    // Everything is loaded now, so the control goes away.
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('does not offer Load more when the page holds every photo', () => {
    render(<PhotoSelector eventId={EVENT_ID} photos={[photo('a')]} total={1} selectedCount={0} />)

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when the event has no photos', () => {
    render(<PhotoSelector eventId={EVENT_ID} photos={[]} />)

    expect(
      screen.getByText(/no photos have been uploaded to this event yet/i)
    ).toBeInTheDocument()
  })
})
