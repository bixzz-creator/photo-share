import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const preferredRegion = 'bom1'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Cheap probe for Vercel's edge load balancer (and any extra proxy in front).
 * Does not touch Auth or Postgres, so it stays fast under traffic.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'photo-share',
      region: process.env.VERCEL_REGION ?? 'local',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
