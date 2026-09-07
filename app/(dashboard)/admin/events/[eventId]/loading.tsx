import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors the real event layout (header, tabs, stat row) so a navigation lands
 * on the right shape immediately and the content fills in underneath, instead
 * of the page jumping from a generic block to something else.
 */
export default function EventLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      <div className="flex gap-6 border-b pb-2.5">
        {['Overview', 'Photos', 'Team', 'Gallery'].map((tab) => (
          <Skeleton key={tab} className="h-5 w-20" />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-32 rounded-xl" />
    </div>
  )
}
