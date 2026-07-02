import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const searchParams = new URL(request.url).searchParams
  const employeeId = searchParams.get('employee_id') ?? searchParams.get('employeeId')
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())

  if (!employeeId) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be a valid year' }, { status: 400 })
  }

  if (!API_URL) {
    return NextResponse.json({ error: 'API URL not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${API_URL}/api/leave/balances/${encodeURIComponent(employeeId)}`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: text || 'Failed to fetch balance' },
        { status: response.status },
      )
    }

    const payload = await response.json()
    const rows: Array<{ leave_type: string; entitled_days: number; used_days: number; remaining_days: number }> =
      payload?.data ?? []

    const balances = Object.fromEntries((rows ?? []).map((row) => [
      row.leave_type,
      {
        entitled: Number(row.entitled_days ?? 0),
        used: Number(row.used_days ?? 0),
        remaining: Number(row.remaining_days ?? 0),
      },
    ]))

    return NextResponse.json({
      employee_id: employeeId,
      year,
      balances,
      annual: balances.annual?.remaining ?? 0,
      casual: balances.casual?.remaining ?? 0,
      sick: balances.sick?.remaining ?? 0,
    })
  } catch (error) {
    console.error('[leave/balance GET]', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
