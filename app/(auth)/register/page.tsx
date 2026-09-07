import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="eyebrow text-brass">Admin account</p>
        <h1 className="title-display text-[2.6rem]">Create your studio</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Register as an admin to run events, add photographers, select photos, and
          publish PIN-protected galleries.
        </p>
      </div>

      <RegisterForm />
    </div>
  )
}
