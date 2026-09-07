import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Public routes
  if (pathname.startsWith('/gallery')) return getResponse()

  if (pathname === '/login' || pathname === '/register') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      return NextResponse.redirect(
        new URL(profile?.role === 'admin' ? '/admin' : '/member', request.url)
      )
    }
    return getResponse()
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/member', request.url))
  }

  if (pathname.startsWith('/member') && profile?.role !== 'member') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return getResponse()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
