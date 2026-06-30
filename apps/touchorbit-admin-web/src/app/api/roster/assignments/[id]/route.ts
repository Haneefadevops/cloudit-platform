import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await verifyPermission(request, 'roster.edit')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const { error } = await auth.supabase
    .from('roster_assignments')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)

  if (error) {
    console.error('[roster/assignments DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
