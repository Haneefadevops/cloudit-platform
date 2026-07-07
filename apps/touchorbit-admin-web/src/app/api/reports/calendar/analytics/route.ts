import { NextRequest, NextResponse } from 'next/server'
import { API_URL, parseJsonBody } from '../../../auth/_lib'

function parseFilters(searchParams: URLSearchParams) {
  return {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    departmentId: searchParams.get('departmentId') || null,
    branchId: searchParams.get('branchId') || null,
  }
}

export async function GET(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json(
      { error: 'API_URL is not configured' },
      { status: 500 },
    )
  }

  const filters = parseFilters(new URL(request.url).searchParams)
  if (!filters.startDate || !filters.endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required' },
      { status: 400 },
    )
  }

  const cookie = request.headers.get('cookie') || ''
  const searchParams = new URLSearchParams()
  searchParams.set('startDate', filters.startDate)
  searchParams.set('endDate', filters.endDate)
  if (filters.departmentId) searchParams.set('departmentId', filters.departmentId)
  if (filters.branchId) searchParams.set('branchId', filters.branchId)

  try {
    const upstream = await fetch(
      `${API_URL}/api/calendar-events/analytics?${searchParams.toString()}`,
      {
        headers: { Cookie: cookie },
      },
    )

    const upstreamText = await upstream.text()
    const payload = parseJsonBody(upstreamText) as
      | { ok?: boolean; data?: unknown; error?: string; message?: string }
      | null

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error || payload?.message || 'Unauthorized',
        },
        { status: upstream.status },
      )
    }

    const data = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload

    return NextResponse.json(
      { data: data ?? {}, meta: { filters } },
      { status: 200 },
    )
  } catch (error) {
    console.error('[reports/calendar/analytics] proxy error:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 },
    )
  }
}
