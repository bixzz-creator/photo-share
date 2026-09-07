import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="eyebrow text-brass">Welcome back</p>
        <h1 className="title-display text-[2.6rem]">Sign in</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Admins sign in to run events and galleries. Photographers use the account
          their admin created for them.
        </p>
      </div>

      <LoginForm />
    </div>
  )
}
