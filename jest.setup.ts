import '@testing-library/jest-dom'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-project.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'
process.env.GALLERY_SESSION_SECRET ??= 'test-gallery-session-secret-32-chars'

if (typeof window !== 'undefined') {
  const win = window as unknown as Record<string, unknown>

  win.matchMedia ??= (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })

  // jsdom has no IntersectionObserver, which GalleryViewer relies on.
  win.IntersectionObserver ??= class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: ReadonlyArray<number> = []
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() {
      return []
    }
  }
}
