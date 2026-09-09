import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  markClassName?: string
  showWordmark?: boolean
  /** Dark rail: ivory wordmark. */
  onDark?: boolean
}

/** Unique PhotoShare Studio mark plus lockup. */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
  onDark = false,
}: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={72}
        height={72}
        priority
        className={cn(
          'h-9 w-9 rounded-[0.7rem] object-cover shadow-[0_1px_2px_hsl(24_14%_12%/0.18)]',
          markClassName
        )}
      />
      {showWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className={cn('brand-wordmark', onDark && 'text-rail-foreground')}>
            PhotoShare
          </span>
          <span className={cn('brand-studio', onDark ? 'text-rail-muted' : 'text-muted-foreground')}>
            Studio
          </span>
        </span>
      )}
    </span>
  )
}
