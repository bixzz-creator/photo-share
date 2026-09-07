import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="eyebrow text-brass">404</p>
      <h1 className="title-display text-4xl">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist, or the gallery link has expired.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  )
}
