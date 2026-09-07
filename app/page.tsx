import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth'

/** Sends visitors to the dashboard that matches their role. */
export default async function HomePage() {
  const context = await getAuthContext()
  if (!context) redirect('/login')
  redirect(context.profile.role === 'admin' ? '/admin' : '/member')
}
