import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { getAuthContext } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getAuthContext()
  if (!context) redirect('/login')

  const { full_name, email, role } = context.profile

  return (
    <DashboardShell fullName={full_name} email={email} role={role}>
      {children}
    </DashboardShell>
  )
}
