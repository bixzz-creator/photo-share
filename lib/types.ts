import type { EventStatus, UserRole } from '@/lib/constants'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface EventRecord {
  id: string
  name: string
  description: string | null
  event_date: string | null
  created_by: string | null
  status: EventStatus
  created_at: string
  updated_at: string
}

export interface EventWithCounts extends EventRecord {
  photo_count: number
  member_count: number
  selected_count: number
}

export interface EventMember {
  id: string
  event_id: string
  member_id: string
  added_by: string | null
  added_at: string
}

export interface MemberWithAssignment extends Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'> {
  isAssigned: boolean
}

export interface Photo {
  id: string
  event_id: string
  uploaded_by: string | null
  filename: string
  original_name: string
  storage_path: string
  public_url: string
  file_size: number
  mime_type: string
  width: number | null
  height: number | null
  is_selected: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PhotoWithUploader extends Photo {
  uploader_name: string | null
  /** Short-lived signed URL. Null when the object could not be signed. */
  signed_url: string | null
}

export interface Gallery {
  id: string
  event_id: string
  created_by: string | null
  title: string
  description: string | null
  slug: string
  is_published: boolean
  published_at: string | null
  expires_at: string | null
  view_count: number
  created_at: string
  updated_at: string
}

/** Shape returned by the public gallery info endpoint. */
export interface PublicGalleryInfo {
  slug: string
  title: string
  description: string | null
  isPublished: boolean
  photoCount: number
  expiresAt: string | null
}

export interface GalleryPhoto {
  id: string
  url: string
  width: number | null
  height: number | null
  displayOrder: number
  originalName: string
}

export interface UploadResultItem {
  filename: string
  success?: boolean
  error?: string
  photo?: Photo
}

export interface Paginated<T> {
  data: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}
