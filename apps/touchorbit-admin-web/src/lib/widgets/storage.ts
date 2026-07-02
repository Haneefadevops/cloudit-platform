import { supabase } from '../supabase'
import type { DashboardConfig } from './types'

export async function loadLayout(userId: string): Promise<DashboardConfig | null> {
  const { data, error } = await supabase
    .from('user_dashboard_layouts')
    .select('widgets, layout_lg, layout_md, layout_sm')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    widgets: data.widgets || [],
    layouts: {
      lg: data.layout_lg || [],
      md: data.layout_md || [],
      sm: data.layout_sm || [],
    },
  }
}

export async function saveLayout(
  userId: string,
  organizationId: string,
  config: DashboardConfig
): Promise<void> {
  const { error } = await supabase.from('user_dashboard_layouts').upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      widgets: config.widgets,
      layout_lg: config.layouts.lg,
      layout_md: config.layouts.md,
      layout_sm: config.layouts.sm,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw error
}

export async function resetLayout(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_dashboard_layouts')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}
