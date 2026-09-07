import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/http'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
