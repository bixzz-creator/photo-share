import { DEFAULT_PAGE_SIZE, PHOTO_PAGE_SIZE, SUPABASE_MAX_ROWS } from '@/lib/constants'
import { withSignedUrls } from '@/lib/photos'
import { createAdminClient, type createClient } from '@/lib/supabase/server'
import type { EventWithCounts, MemberWithAssignment, PhotoWithUploader } from '@/lib/types'

type ServerClient = ReturnType<typeof createClient>
type CountRow = { count: number }

function embeddedCount(rows?: CountRow[] | null) {
  return rows?.[0]?.count ?? 0
}

interface ListEventsOptions {
  /** Restrict to the events this member is assigned to. */
  memberId?: string | null
  page?: number
  limit?: number
}

/**
 * Shared by the dashboards and event lists so pages can render from the
 * database directly instead of calling their own API over HTTP.
 */
export async function listEventsWithCounts(
  supabase: ServerClient,
  { memberId = null, page = 1, limit = DEFAULT_PAGE_SIZE }: ListEventsOptions = {}
): Promise<{ events: EventWithCounts[]; total: number; totalPages: number }> {
  const from = (page - 1) * limit

  let query = supabase
    .from('events')
    .select('*, photos(count), event_members(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (memberId) {
    const { data: assignments } = await supabase
      .from('event_members')
      .select('event_id')
      .eq('member_id', memberId)

    const assignedIds = (assignments ?? []).map((row) => row.event_id)
    if (assignedIds.length === 0) return { events: [], total: 0, totalPages: 0 }

    query = query.in('id', assignedIds)
  }

  const { data, count, error } = await query
  if (error) {
    console.error('[queries] listEventsWithCounts failed', error)
    return { events: [], total: 0, totalPages: 0 }
  }

  const rows = data ?? []
  const selectedByEvent = new Map<string, number>()

  if (rows.length > 0) {
    const { data: selected } = await supabase
      .from('photos')
      .select('event_id')
      .eq('is_selected', true)
      .in(
        'event_id',
        rows.map((row) => row.id)
      )

    for (const row of selected ?? []) {
      selectedByEvent.set(row.event_id, (selectedByEvent.get(row.event_id) ?? 0) + 1)
    }
  }

  const events = rows.map(({ photos, event_members, ...event }) => ({
    ...(event as Omit<EventWithCounts, 'photo_count' | 'member_count' | 'selected_count'>),
    photo_count: embeddedCount(photos as CountRow[] | null),
    member_count: embeddedCount(event_members as CountRow[] | null),
    selected_count: selectedByEvent.get(event.id) ?? 0,
  })) as EventWithCounts[]

  const total = count ?? events.length

  return { events, total, totalPages: Math.ceil(total / limit) }
}

interface ListPhotosOptions {
  /** Members only ever see their own uploads. */
  uploaderId?: string | null
  selectedOnly?: boolean
  page?: number
  limit?: number
}

export interface PhotoPage {
  photos: PhotoWithUploader[]
  /** Photos matching the filters across the whole event, not just this page. */
  total: number
  /** Photos flagged for the gallery across the whole event. */
  selectedCount: number
  page: number
  limit: number
  totalPages: number
}

/**
 * One page of an event's photos, with counts for the whole event.
 *
 * An event can hold far more photos than a single request may return, so
 * everything that renders a grid pages through this rather than asking for the
 * lot: Supabase would cap the response at {@link SUPABASE_MAX_ROWS} and the
 * extra rows would vanish without an error.
 */
export async function listEventPhotos(
  supabase: ServerClient,
  eventId: string,
  { uploaderId = null, selectedOnly = false, page = 1, limit = PHOTO_PAGE_SIZE }: ListPhotosOptions = {}
): Promise<PhotoPage> {
  const safePage = Math.max(1, Math.trunc(page))
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), SUPABASE_MAX_ROWS)
  const from = (safePage - 1) * safeLimit

  let query = supabase
    .from('photos')
    .select('*, uploader:profiles!photos_uploaded_by_fkey(full_name)', { count: 'exact' })
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1)

  if (uploaderId) query = query.eq('uploaded_by', uploaderId)
  if (selectedOnly) query = query.eq('is_selected', true)

  let selectedQuery = supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('is_selected', true)

  if (uploaderId) selectedQuery = selectedQuery.eq('uploaded_by', uploaderId)

  const [{ data, count, error }, { count: selectedCount }] = await Promise.all([
    query,
    selectedQuery,
  ])

  if (error) {
    console.error('[queries] listEventPhotos failed', error)
    return { photos: [], total: 0, selectedCount: 0, page: safePage, limit: safeLimit, totalPages: 0 }
  }

  const total = count ?? (data ?? []).length

  return {
    photos: await withSignedUrls(createAdminClient(), data ?? []),
    total,
    selectedCount: selectedOnly ? total : selectedCount ?? 0,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  }
}

/**
 * Every matching photo id for an event, read in {@link SUPABASE_MAX_ROWS}
 * chunks. Publishing needs the complete set, and ids are small enough to hold
 * in memory when the rendered photos are not.
 */
export async function listEventPhotoIds(
  supabase: ServerClient,
  eventId: string,
  { uploaderId = null, selectedOnly = false }: Omit<ListPhotosOptions, 'page' | 'limit'> = {}
): Promise<string[]> {
  const ids: string[] = []

  for (let from = 0; ; from += SUPABASE_MAX_ROWS) {
    let query = supabase
      .from('photos')
      .select('id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(from, from + SUPABASE_MAX_ROWS - 1)

    if (uploaderId) query = query.eq('uploaded_by', uploaderId)
    if (selectedOnly) query = query.eq('is_selected', true)

    const { data, error } = await query
    if (error) {
      console.error('[queries] listEventPhotoIds failed', error)
      break
    }

    const rows = data ?? []
    ids.push(...rows.map((row) => row.id))
    if (rows.length < SUPABASE_MAX_ROWS) break
  }

  return ids
}

/** Member accounts with a flag for whether they are on the given event. */
export async function listMembersForEvent(
  supabase: ServerClient,
  eventId: string
): Promise<MemberWithAssignment[]> {
  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('role', 'member')
      .order('full_name', { ascending: true }),
    supabase.from('event_members').select('member_id').eq('event_id', eventId),
  ])

  const assigned = new Set((assignments ?? []).map((row) => row.member_id))

  return (profiles ?? []).map((profile) => ({
    ...profile,
    isAssigned: assigned.has(profile.id),
  }))
}
