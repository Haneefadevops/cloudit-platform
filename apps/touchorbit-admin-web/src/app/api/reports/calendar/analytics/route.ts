import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

function parseFilters(searchParams: URLSearchParams) {
  return {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    departmentId: searchParams.get('departmentId') || null,
    branchId: searchParams.get('branchId') || null,
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const filters = parseFilters(new URL(request.url).searchParams)
  if (!filters.startDate || !filters.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_calendar_analytics', {
    p_org_id: auth.profile.organization_id,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_department_id: filters.departmentId,
    p_branch_id: filters.branchId,
  })

  if (error) {
    console.error('[reports/calendar/analytics]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? {}, meta: { filters } })
}
