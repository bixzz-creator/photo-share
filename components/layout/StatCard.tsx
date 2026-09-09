import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  /** Small note under the value, e.g. "600 selected". */
  hint?: React.ReactNode
  /** Draws attention to the number that matters most on the page. */
  emphasis?: boolean
}

export function StatCard({ label, value, icon: Icon, hint, emphasis = false }: StatCardProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl border bg-card p-6 shadow-card transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lift',
        emphasis && 'border-brass/30 bg-brass-soft/50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow truncate text-base text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            emphasis ? 'bg-brass/15 text-brass' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="stat-figure mt-4 text-[2.15rem]">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
