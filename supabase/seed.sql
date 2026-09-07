-- ============================================================
-- Demo data. Safe to re-run.
--
-- Creates one admin and two members, an event, and assignments.
-- Passwords for every seeded account: Password123!
--
-- Run AFTER migrations/001_initial_schema.sql.
-- Intended for local / throwaway projects only.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id  UUID := '11111111-1111-1111-1111-111111111111';
  member_a  UUID := '22222222-2222-2222-2222-222222222222';
  member_b  UUID := '33333333-3333-3333-3333-333333333333';
  event_id  UUID := '44444444-4444-4444-4444-444444444444';
  seed_user RECORD;
BEGIN
  FOR seed_user IN
    SELECT * FROM (
      VALUES
        (admin_id, 'admin@example.com',  'Ava Administrator', 'admin'),
        (member_a, 'member1@example.com', 'Milo Member',       'member'),
        (member_b, 'member2@example.com', 'Nina Member',       'member')
    ) AS t(id, email, full_name, role)
  LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    VALUES (
      seed_user.id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      seed_user.email,
      crypt('Password123!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', seed_user.full_name, 'role', seed_user.role),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      seed_user.id,
      seed_user.id::text,
      'email',
      jsonb_build_object('sub', seed_user.id::text, 'email', seed_user.email),
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING;

    -- The on_auth_user_created trigger normally creates this row; upsert so the
    -- seed also works when the trigger is disabled or the user already existed.
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (seed_user.id, seed_user.email, seed_user.full_name, seed_user.role)
    ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          role = EXCLUDED.role;
  END LOOP;

  INSERT INTO public.events (id, name, description, event_date, created_by, status)
  VALUES (
    event_id,
    'Riverside Wedding',
    'Two photographers covering the ceremony and the reception.',
    CURRENT_DATE - 7,
    admin_id,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.event_members (event_id, member_id, added_by)
  VALUES (event_id, member_a, admin_id),
         (event_id, member_b, admin_id)
  ON CONFLICT (event_id, member_id) DO NOTHING;
END $$;
