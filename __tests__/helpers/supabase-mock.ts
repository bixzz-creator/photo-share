/**
 * Minimal stand-in for the Supabase JS client.
 *
 * Query builders are thenable, so `await supabase.from('x').select()` resolves
 * to whatever the test queued for that table. Queue one result per call in the
 * order the route makes them.
 */

export interface QueryResult {
  data?: unknown
  error?: unknown
  count?: number
}

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'is',
  'in',
  'like',
  'ilike',
  'not',
  'or',
  'filter',
  'match',
  'order',
  'range',
  'limit',
  'returns',
] as const

export type QueryBuilderMock = Record<string, jest.Mock> & {
  then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>
}

export function createQueryBuilder(result: QueryResult = { data: null, error: null }) {
  const builder = {} as QueryBuilderMock

  for (const method of CHAIN_METHODS) {
    builder[method] = jest.fn(() => builder)
  }

  builder.single = jest.fn(() => Promise.resolve(result))
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))
  builder.csv = jest.fn(() => Promise.resolve(result))
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)

  return builder
}

export interface StorageOverrides {
  upload?: jest.Mock
  remove?: jest.Mock
  download?: jest.Mock
  getPublicUrl?: jest.Mock
  createSignedUrl?: jest.Mock
  createSignedUrls?: jest.Mock
}

export interface SupabaseMockOptions {
  /** Result of `auth.getUser()`. */
  user?: { id: string; email?: string } | null
  /** Per-table results. Pass an array to queue successive calls. */
  tables?: Record<string, QueryResult | QueryResult[]>
  auth?: Record<string, jest.Mock>
  /** Service-role `auth.admin` methods, e.g. `createUser`. */
  authAdmin?: Record<string, jest.Mock>
  storage?: StorageOverrides
  rpc?: jest.Mock
}

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const { user = null, tables = {}, auth = {}, authAdmin = {}, storage = {}, rpc } = options

  const callCounts = new Map<string, number>()
  const builders = new Map<string, QueryBuilderMock[]>()

  function nextResult(table: string): QueryResult {
    const configured = tables[table]
    if (!configured) return { data: null, error: null }

    if (Array.isArray(configured)) {
      const index = callCounts.get(table) ?? 0
      callCounts.set(table, index + 1)
      return configured[Math.min(index, configured.length - 1)] ?? { data: null, error: null }
    }

    return configured
  }

  const storageApi = {
    upload: storage.upload ?? jest.fn(async () => ({ data: { path: 'uploaded' }, error: null })),
    remove: storage.remove ?? jest.fn(async () => ({ data: [], error: null })),
    download:
      storage.download ??
      jest.fn(async () => ({
        data: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
        error: null,
      })),
    getPublicUrl:
      storage.getPublicUrl ??
      jest.fn(() => ({ data: { publicUrl: 'https://storage.test/public.png' } })),
    createSignedUrl:
      storage.createSignedUrl ??
      jest.fn(async () => ({ data: { signedUrl: 'https://storage.test/signed.png' }, error: null })),
    createSignedUrls:
      storage.createSignedUrls ??
      jest.fn(async (paths: string[]) => ({
        data: paths.map((path) => ({ path, signedUrl: `https://storage.test/${path}`, error: null })),
        error: null,
      })),
  }

  const client = {
    from: jest.fn((table: string) => {
      const builder = createQueryBuilder(nextResult(table))
      builders.set(table, [...(builders.get(table) ?? []), builder])
      return builder
    }),
    rpc: rpc ?? jest.fn(async () => ({ data: null, error: null })),
    storage: { from: jest.fn(() => storageApi) },
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: user ? { id: user.id, email: user.email ?? 'user@example.com' } : null },
        error: user ? null : { message: 'Auth session missing' },
      })),
      signUp: jest.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signInWithPassword: jest.fn(async () => ({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      })),
      signOut: jest.fn(async () => ({ error: null })),
      admin: {
        createUser: jest.fn(async () => ({
          data: { user: { id: 'created-user', email: 'created@example.com' } },
          error: null,
        })),
        deleteUser: jest.fn(async () => ({ data: null, error: null })),
        ...authAdmin,
      },
      ...auth,
    },
    /** Builders created for a table, in call order. Handy for assertions. */
    __builders: (table: string) => builders.get(table) ?? [],
    __storage: storageApi,
  }

  return client
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>

/** Profile row for an admin user. */
export function adminProfile(id = 'admin-1') {
  return {
    id,
    email: 'admin@example.com',
    full_name: 'Ava Administrator',
    role: 'admin',
    avatar_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

/** Profile row for a member user. */
export function memberProfile(id = 'member-1') {
  return {
    id,
    email: 'member@example.com',
    full_name: 'Milo Member',
    role: 'member',
    avatar_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}
