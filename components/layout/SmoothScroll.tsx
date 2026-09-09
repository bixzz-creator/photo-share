'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * After in-app navigation, ease back to the top of the page. Native CSS
 * `scroll-behavior: smooth` on html does the rest, including iOS momentum.
 */
export function SmoothScroll() {
  const pathname = usePathname()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0)
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname])

  return null
}
