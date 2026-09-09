-- ============================================================
-- Photo Sharing Platform - initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENTS table
CREATE TABLE public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENT MEMBERS table (junction)
CREATE TABLE public.event_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- PHOTOS table
-- Metadata only. Image bytes are NEVER stored here — they live in the private
-- Storage bucket `photos` at `storage_path`.
CREATE TABLE public.photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  is_selected BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GALLERIES table
CREATE TABLE public.galleries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GALLERY PHOTOS junction table
CREATE TABLE public.gallery_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gallery_id UUID REFERENCES public.galleries(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gallery_id, photo_id)
);

-- GALLERY ACCESS SESSIONS (for PIN verification)
CREATE TABLE public.gallery_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gallery_id UUID REFERENCES public.galleries(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- ROW LEVEL SECURITY POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_sessions ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- EVENTS policies
CREATE POLICY "Admins can do everything with events" ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Members can view assigned events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_members WHERE event_id = events.id AND member_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- PHOTOS policies
CREATE POLICY "Admins can manage all photos" ON public.photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Members can upload to assigned events" ON public.photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.event_members WHERE event_id = photos.event_id AND member_id = auth.uid())
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Members can view photos of assigned events" ON public.photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_members WHERE event_id = photos.event_id AND member_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INDEXES for performance
CREATE INDEX idx_photos_event_id ON public.photos(event_id);
CREATE INDEX idx_photos_uploaded_by ON public.photos(uploaded_by);
CREATE INDEX idx_photos_is_selected ON public.photos(is_selected);
CREATE INDEX idx_event_members_event_id ON public.event_members(event_id);
CREATE INDEX idx_event_members_member_id ON public.event_members(member_id);
CREATE INDEX idx_galleries_slug ON public.galleries(slug);
CREATE INDEX idx_gallery_photos_gallery_id ON public.gallery_photos(gallery_id);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.galleries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Additional objects required by the application
-- ============================================================

-- Tracks whether a gallery session already counted towards view_count.
ALTER TABLE public.gallery_sessions
  ADD COLUMN IF NOT EXISTS viewed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_gallery_sessions_token
  ON public.gallery_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_galleries_event_id
  ON public.galleries(event_id);

-- Helper used by policies to avoid repeating the admin lookup.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- EVENT MEMBERS policies
CREATE POLICY "Admins can manage event members" ON public.event_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Members can view own assignments" ON public.event_members
  FOR SELECT USING (member_id = auth.uid());

-- PHOTOS: members may remove their own uploads
CREATE POLICY "Members can delete own photos" ON public.photos
  FOR DELETE USING (uploaded_by = auth.uid());

CREATE POLICY "Members can update own photo metadata" ON public.photos
  FOR UPDATE USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid() AND is_selected = FALSE);

-- GALLERIES policies (public gallery reads go through the service role client)
CREATE POLICY "Admins can manage galleries" ON public.galleries
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Members can view galleries of assigned events" ON public.galleries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_members
      WHERE event_id = galleries.event_id AND member_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage gallery photos" ON public.gallery_photos
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- gallery_sessions intentionally has no policies: it is only written/read by
-- the service role client from public gallery API routes.

-- Atomic view counter used by /api/gallery/[gallerySlug]/verify
CREATE OR REPLACE FUNCTION public.increment_view_count(gallery_id UUID)
RETURNS VOID AS $$
  UPDATE public.galleries
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = gallery_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Housekeeping helper: drop expired PIN sessions.
CREATE OR REPLACE FUNCTION public.purge_expired_gallery_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM public.gallery_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- STORAGE: private "photos" bucket + policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  FALSE,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage paths look like: events/{eventId}/{userId}/{timestamp}-{random}.{ext}
--   name split: [1] = 'events', [2] = eventId, [3] = userId

CREATE POLICY "Members can upload into their own event folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.event_members
      WHERE member_id = auth.uid()
        AND event_id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Admins can read all photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos' AND public.is_admin());

CREATE POLICY "Members can read photos of assigned events"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1 FROM public.event_members
      WHERE member_id = auth.uid()
        AND event_id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Admins can delete any photo object"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photos' AND public.is_admin());

CREATE POLICY "Members can delete own photo objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );
