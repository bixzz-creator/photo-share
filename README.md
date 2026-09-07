# Photo Sharing Platform

Event photo workflow for photography teams, built to run entirely on free tiers.

Admins create events and assign photographers. Photographers upload their shots.
Admins review the uploads, pick the keepers, and publish a PIN protected gallery
that the customer opens with a link — no account required.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres, Auth, Storage) ·
Tailwind CSS · shadcn/ui · Jest + React Testing Library · deploys to Vercel.

---

## Architecture

```
      Admin              Photographer            Customer
   (browser)              (browser)          (browser, no account)
        |                     |                      |
        |  session cookie     |  session cookie      |  gallery PIN
        v                     v                      v
 +--------------------------------------------------------------+
 |                  Next.js 14 on Vercel                         |
 |                                                               |
 |  middleware.ts ....... role gate for /admin/* and /member/*   |
 |                                                               |
 |  Server Components ... read Postgres directly (RLS applies)   |
 |  Route handlers ...... /api/* : the only place writes happen  |
 |                        Zod validation + requireAdmin guards   |
 +--------------------------------------------------------------+
        |                        |                       |
        | anon key + RLS         | service role          | service role
        v                        v                       v
 +--------------+      +------------------+      +----------------+
 |  Supabase    |      |  Supabase        |      |  Supabase      |
 |  Auth        |      |  Postgres        |      |  Storage       |
 |              |      |  7 tables, RLS   |      |  private       |
 |  email +     |      |  on every one    |      |  "photos"      |
 |  password    |      |                  |      |  bucket        |
 +--------------+      +------------------+      +----------------+
                                                         |
                                    1-hour signed URLs ---+
                                    (the only way a browser
                                     ever reaches an image)
```

Two rules hold the design together. Reads go straight from Server Components to
Postgres, so rendering a page never makes an HTTP call back into the app's own
API. Writes always go through `/api/*`, so authorization lives in exactly one
place per resource — with RLS underneath as a second, independent layer.

### Data model

```
profiles ──< event_members >── events ──< photos
   |                              |          |
   | created_by                   |          | is_selected
   v                              v          v
                              galleries ──< gallery_photos
                                  |
                                  └──< gallery_sessions   (PIN exchanged
                                        token, 24h TTL)
```

`profiles` extends `auth.users` through a trigger and carries the `admin` or
`member` role. `event_members` is the junction that scopes a photographer to an
event — it is what every "can this user touch this event?" check reads.
`galleries` holds the bcrypt PIN hash and the public slug; `gallery_sessions`
turns a correct PIN into a signed, expiring token so the PIN is never replayed.

---

## 1. Create the Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`.
   It creates the tables, RLS policies, triggers, the `increment_view_count`
   function, and the private `photos` storage bucket with its policies.
3. Optional demo data: run `supabase/seed.sql`. It creates one admin
   (`admin@example.com`) and two members (`member1@example.com`,
   `member2@example.com`), all with the password `Password123!`. Use it on
   throwaway projects only.
4. Under **Authentication → Providers → Email**, turn off "Confirm email" so an
   admin can sign in straight after registering. Photographer accounts are
   unaffected either way: the admin creates them with `email_confirm`, so they
   never receive a confirmation mail.

The migration is idempotent about the storage bucket but not about the tables:
run it once on a fresh database.

## 2. Configure the environment

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | Safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API | Safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | **Server only.** Bypasses RLS |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally | Used to build gallery links |
| `GALLERY_SESSION_SECRET` | `openssl rand -hex 32` | Signs gallery session tokens |

## 3. Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Jest + React Testing Library
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run build        # production build
```

Open `/register` to create an admin account, then sign in. Create an event,
then use **Add photographer** on the event's team page to create photographer
accounts: each one is created already confirmed and already assigned to the
event, and its password is shown once for you to pass on. Sign in as that
photographer to upload, then go back to the admin to select photos and publish.

---

## Roles and routes

### Admin / Lead

An admin can register, sign in, and then:

- Create an event
- Add team members (photographer accounts)
- View every photo the team uploaded
- Select photos for sharing
- Create and publish a gallery
- Generate a shareable link
- Set a PIN for that gallery

Photographers do not self-register. The admin creates those accounts from the
event team page and hands over the password once.

| Route | Who | Purpose |
| --- | --- | --- |
| `/login` | Anyone | Sign in. Signed-in users are bounced to their dashboard |
| `/register` | Anyone | Creates an admin account |
| `/admin` | Admin | Stats, recent events, quick actions |
| `/admin/events` | Admin | Paginated event list |
| `/admin/events/[id]` | Admin | Event overview, inline edit, galleries |
| `/admin/events/[id]/photos` | Admin | Review uploads, select gallery photos |
| `/admin/events/[id]/members` | Admin | Assign or remove photographers |
| `/admin/events/[id]/gallery` | Admin | Publish a PIN protected gallery |
| `/member` | Member | Assigned events and upload totals |
| `/member/events` | Member | Assigned events |
| `/member/events/[id]/upload` | Member | Drag and drop uploader plus own uploads |
| `/gallery/[slug]` | Public | PIN entry |
| `/gallery/[slug]/view` | Public + session | Gallery viewer with lightbox |

`middleware.ts` guards everything: `/admin/*` needs the admin role, `/member/*`
needs the member role, `/gallery/*` is always public, and anonymous visitors are
redirected to `/login`. API routes are excluded from the matcher and each one
performs its own authorization.

## API

| Method + path | Auth | Behaviour |
| --- | --- | --- |
| `POST /api/auth/register` | Public | Creates an admin. Role cannot be chosen by the caller |
| `POST /api/members` | Admin | Creates a photographer account, optionally assigning it to an event. Returns the password once |
| `POST /api/auth/login` | Public | Sign in, returns the role based redirect |
| `POST /api/auth/logout` | Public | Clears the session |
| `GET /api/auth/me` | Session | Current profile |
| `GET /api/events` | Session | Admin: all events. Member: assigned only. `?page=&limit=` |
| `POST /api/events` | Admin | Create an event |
| `GET /api/events/[id]` | Session | Event, members, photo stats, galleries |
| `PUT /api/events/[id]` | Admin | Update name, description, date, status |
| `DELETE /api/events/[id]` | Admin | Soft delete: status becomes `archived` |
| `GET /api/events/[id]/members` | Admin | All member accounts with an `isAssigned` flag |
| `POST /api/events/[id]/members` | Admin | Assign a member |
| `DELETE /api/events/[id]/members/[memberId]` | Admin | Unassign a member |
| `GET /api/events/[id]/photos` | Session | One page of photos. Admin: all. Member: own uploads. `?selected=true&page=1&limit=60` |
| `POST /api/events/[id]/photos/select` | Admin | Select or clear every photo on the event in one statement |
| `POST /api/photos` | Session | Multipart upload, up to 50 files |
| `GET /api/photos/[id]` | Session | Metadata plus a signed URL |
| `PATCH /api/photos/[id]` | Admin | Toggle `is_selected` |
| `DELETE /api/photos/[id]` | Session | Admin: any. Member: own uploads |
| `GET /api/gallery?eventId=` | Admin | Galleries for an event |
| `POST /api/gallery` | Admin | Publish a gallery, returns `{galleryUrl, slug, pin}` |
| `GET /api/gallery/[slug]` | Public | Title, description, photo count. Never the PIN hash |
| `POST /api/gallery/[slug]/verify` | Public | Exchanges the PIN for a session token |
| `GET /api/gallery/[slug]/photos` | Gallery session | Signed URLs, 1 hour expiry |

### Uploads

`POST /api/photos` takes `eventId`, one or more `files`, and an optional
`dimensions` JSON map (`{"photo.jpg": {"width": 1600, "height": 1200}}`) that the
uploader fills in from the client-side preview.

Each file is validated on its own, so one bad file never fails the batch. The
response lists a result per file and returns **201** when at least one file
landed, **400** when every file failed. `PhotoUploader` sends one request per
file so each row can show its own progress bar and be retried individually.

### Large events

A wedding can produce a few thousand photos, which is more than Supabase will
return in one request — its API caps a response at 1000 rows and drops the rest
without raising an error. Every photo grid therefore reads a page at a time:

- Server Components render the first 60 through `listEventPhotos`, so the grid
  is useful before any JavaScript loads, and "Load more" fetches the next page
  from `GET /api/events/[id]/photos`.
- Totals come from a `count` query rather than from the rows on screen, so
  "600 of 1250 selected" stays correct while most of the event is unloaded.
- "Select all" is a single `UPDATE` behind
  `POST /api/events/[id]/photos/select`, not one request per photo.
- Publishing needs the whole selection, so `listEventPhotoIds` pages through
  ids (small enough to hold in memory when the rendered rows are not) and the
  gallery is created from that complete list.

### Page latency

A Supabase round trip from a browser to a free-tier project is roughly 150–200
ms, so a dashboard page is only as fast as the number of queries it waits on in
sequence. Three rules keep that count down:

- **`getAuthContext` is deduplicated per request** (React `cache`). The
  dashboard layout and the page inside it both need the signed-in profile;
  without deduplication each navigation paid for two `getUser` calls and two
  profile reads before touching page data.
- **Independent reads go out together.** The event page issues its event row
  and its four counts in one `Promise.all` rather than fetching the event and
  then everything else.
- **The shell does not fetch.** Per-event navigation lives in `EventTabs` on
  the page, so the shared layout no longer calls the events API on every
  navigation just to label a sidebar section.

Photo grids also record each image's pixel dimensions at upload time and
reserve that aspect ratio in the card, so images fade into a fixed box instead
of pushing the grid around as they arrive.

Note that `npm run dev` compiles each route the first time you open it, which
can take ten seconds and is not representative. Use `npm run build && npm run
start` to judge real navigation speed.

## Security

- **Authorization on every route.** `lib/auth.ts` provides `requireUser`,
  `requireAdmin` and `requireEventAccess`; RLS in Postgres is the second layer,
  so a mistake in a route handler still cannot read another team's data.
- **Uploads are checked by content, not by claim.** `lib/file-validation.ts`
  compares the declared MIME type against the file's magic bytes and rejects
  mismatches, alongside the 10 MB size cap.
- **Input validation.** Zod schemas in `lib/validations/` cover every request
  body and query string. Free text fields are stripped of control characters.
- **Private storage.** The `photos` bucket is private. Every image the browser
  loads, including customer galleries, is a signed URL that expires in an hour.
- **Gallery PINs.** Hashed with bcrypt (10 rounds) and never returned by any
  endpoint. The plaintext PIN is shown once, right after publishing.
- **Gallery sessions.** `crypto.randomBytes(32)` tokens stored in
  `gallery_sessions`, expiring after 24 hours. The value handed to the browser
  carries an HMAC signature (`GALLERY_SESSION_SECRET`) so forged tokens are
  rejected before they reach the database, and a token only works for the
  gallery it was issued for. It travels in an httpOnly cookie and, when
  available, the `x-gallery-session` header.
- **Rate limits** (`lib/rate-limit.ts`): 5 PIN attempts per IP per hour (only
  wrong attempts count, so reopening a link never locks a customer out), 100
  uploads per user per hour, 10 auth attempts per IP per 15 minutes.
- **Unpublished or expired galleries return 404** to the public, so a link never
  reveals that a gallery exists.

- **Admins register themselves; photographers do not.** `/register` always
  creates `role: 'admin'`, ignoring any role in the body. Photographer accounts
  are created by an admin through `POST /api/members`, which forces
  `role: 'member'`. The generated password is returned exactly once; Supabase
  keeps only a hash of it.

One thing to change before real production use:

1. Rate limiting is in process memory, so each serverless instance counts
   separately. Swap the store in `lib/rate-limit.ts` for
   [`@upstash/ratelimit`](https://github.com/upstash/ratelimit) (free tier) if
   you need limits shared across instances.

## Deploying to Vercel

1. Push the repository to GitHub, then import it at
   [vercel.com/new](https://vercel.com/new). The framework preset is detected.
2. Add all five environment variables from `.env.example` to the project. Set
   `NEXT_PUBLIC_APP_URL` to the deployment URL, e.g.
   `https://your-app.vercel.app`, because gallery links are built from it.
3. Deploy, then add the same URL to **Authentication → URL Configuration** in
   Supabase (Site URL plus a `/**` redirect entry).

Everything stays inside the free tiers: Vercel Hobby for hosting, Supabase free
for Postgres, Auth and 1 GB of storage. Photos are served through signed URLs
rather than `next/image`, so no image-optimisation quota is consumed.

## Testing

85 tests across 8 suites.

```
__tests__/api/auth.test.ts          admin registration, login, 401s, rate limiting
__tests__/api/members.test.ts       admin-provisioned photographer accounts
__tests__/api/events.test.ts        admin vs member permissions, assignment scoping
__tests__/api/photos.test.ts        upload validation, magic bytes, size cap, selection rights, paging
__tests__/api/gallery.test.ts       publishing, PIN verification, lockout, session expiry
__tests__/components/PinEntry.test.tsx        6 boxes, focus advance, backspace, auto submit
__tests__/components/PhotoUploader.test.tsx   accepted files, rejections, previews
__tests__/components/PhotoSelector.test.tsx   selection persistence, bulk select, load more
```

API route tests run in Jest's `node` environment (set per file with an
`@jest-environment` docblock) and drive the real route handlers against the
Supabase mock in `__tests__/helpers/supabase-mock.ts`. Component tests run in
jsdom; `jest.polyfills.ts` fills in the web primitives jsdom lacks.

## Project layout

```
app/
  (auth)/           login and register
  (dashboard)/      admin and member areas behind the sidebar shell
  gallery/          public PIN page and viewer
  api/              route handlers
components/
  auth/ events/ photos/ gallery/ team/ layout/
  ui/               shadcn/ui primitives
lib/
  supabase/         browser, server and middleware clients
  validations/      Zod schemas
  auth.ts           route guards
  rate-limit.ts     in-memory fixed window limiter
  file-validation.ts magic byte checks
  gallery-session.ts token signing and lookup
  photos.ts         signed URL helpers
  queries.ts        shared reads used by Server Components
supabase/
  migrations/001_initial_schema.sql
  seed.sql
```

Server Components read from Postgres directly through the request-scoped
Supabase client, so a page render never makes an HTTP call back into its own API.
Mutations go the other way: client components call the API routes, which are the
single place authorization is enforced.

### Notes on the schema

`001_initial_schema.sql` contains the schema as specified, followed by the extra
objects the application needs:

- RLS policies for `event_members`, `galleries` and `gallery_photos` (the base
  schema enables RLS on them without adding policies, which would block admin
  writes), plus member delete rights on their own photos.
- `gallery_sessions.viewed`, so `view_count` counts one view per session on
  first access rather than once per PIN entry.
- `is_admin()`, a `SECURITY DEFINER` helper that keeps the policies readable and
  avoids recursive policy evaluation.
- `increment_view_count()` and `purge_expired_gallery_sessions()`.
- The private `photos` bucket and its storage policies.

`gallery_sessions` has no policies on purpose: only the service-role client in
the public gallery routes touches it.
