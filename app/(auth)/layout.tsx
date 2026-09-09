import { Logo } from '@/components/brand/Logo'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden bg-rail p-10 text-rail-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(38 22% 92% / 0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(38 22% 92% / 0.08) 1px, transparent 1px)',
            backgroundSize: '4.5rem 5.5rem',
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brass/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-brass/10 blur-3xl"
          aria-hidden="true"
        />

        <Link href="/" className="relative">
          <Logo onDark />
        </Link>

        <div className="relative max-w-md space-y-5">
          <p className="eyebrow text-brass">For photography teams</p>
          <h2 className="title-display text-[3rem] leading-[1.05]">
            Every shot from the day, curated into one gallery.
          </h2>
          <p className="text-sm leading-relaxed text-rail-muted">
            Your team uploads as they shoot. You keep the frames worth showing. The
            client opens a private gallery with a link and a PIN.
          </p>
        </div>

        <ol className="relative space-y-3 text-sm text-rail-muted">
          {['Team uploads', 'You curate', 'Client views'].map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brass/40 text-[0.7rem] tabular-nums text-brass">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col items-center justify-center bg-background px-4 py-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  )
}
