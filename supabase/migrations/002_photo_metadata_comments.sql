-- ============================================================
-- Photo rows are metadata only. Image files live in Storage.
-- Safe to run on a database that already applied 001_initial_schema.sql.
-- ============================================================

COMMENT ON TABLE public.photos IS
  'Photo metadata only. Image bytes are stored in the private Storage bucket "photos", never in this table.';

COMMENT ON COLUMN public.photos.id IS 'Photo ID';
COMMENT ON COLUMN public.photos.event_id IS 'Event ID this photo belongs to';
COMMENT ON COLUMN public.photos.uploaded_by IS 'Profile ID of the uploader';
COMMENT ON COLUMN public.photos.filename IS 'Stored object filename';
COMMENT ON COLUMN public.photos.original_name IS 'Original filename from the uploader';
COMMENT ON COLUMN public.photos.storage_path IS 'Storage location in the photos bucket (events/{eventId}/{userId}/{file})';
COMMENT ON COLUMN public.photos.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.photos.created_at IS 'When the metadata row was created';
