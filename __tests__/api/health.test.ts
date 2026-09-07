/**
 * @jest-environment node
 */
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returns a load-balancer probe payload', async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.service).toBe('photo-share')
    expect(payload.timestamp).toEqual(expect.any(String))
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
