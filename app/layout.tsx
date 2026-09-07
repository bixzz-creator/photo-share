import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Figtree } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const sans = Figtree({ subsets: ['latin'], variable: '--font-sans' })

/** High-contrast serif used for titles and italic labels. */
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: {
    default: 'Photo Sharing Platform',
    template: '%s · Photo Sharing Platform',
  },
  description:
    'Collect event photos from your team, curate the best shots, and share PIN protected galleries with clients.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#f7f4ee',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
