import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  /** Status pill or similar, shown beside the title. */
  badge?: React.ReactNode
  /** Buttons, right aligned on wide screens and wrapped underneath on narrow ones. */
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
}

/**
 * The top of every dashboard page. Having one component means titles, spacing
 * and the action row line up across pages instead of drifting per screen.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  backHref,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="title-display truncate text-[1.7rem] leading-tight sm:text-[2rem]">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <div className="max-w-2xl text-sm text-muted-foreground">{description}</div>
          )}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
