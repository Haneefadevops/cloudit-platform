import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{ token: string }>
}

function publicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params
  const searchParams = new URL(request.url).searchParams
  const startDate = searchParams.get('startDate') ?? new Date().toISOString().slice(0, 10)
  const endDate = searchParams.get('endDate') ?? startDate

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 })
  }

  const { data, error } = await publicSupabase().rpc('get_public_calendar_events', {
    p_token: token,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) {
    const status = error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('expired') ? 404 : 500
    console.error('[calendar/public/[token] GET]', error)
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({
    data: data ?? [],
    meta: {
      count: data?.length ?? 0,
      start_date: startDate,
      end_date: endDate,
    },
  })
}
