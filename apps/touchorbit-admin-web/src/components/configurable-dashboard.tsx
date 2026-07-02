'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { ResponsiveGridLayout } from 'react-grid-layout'
import type { LayoutItem } from 'react-grid-layout'
import { useAuth } from '@/lib/auth'
import { loadLayout, saveLayout, resetLayout } from '@/lib/widgets/storage'
import { getDefaultLayoutForRole } from '@/lib/widgets/defaults'
import { getWidget } from '@/lib/widgets/registry'
import type { DashboardConfig, WidgetInstance, WidgetType } from '@/lib/widgets/types'

// Stamp minW/minH on every layout item so the grid enforces the minimum size
// from the widget registry, regardless of what was persisted.
function enrichLayouts(
  widgets: WidgetInstance[],
  layouts: DashboardConfig['layouts']
): DashboardConfig['layouts'] {
  function enrich(items: LayoutItem[]): LayoutItem[] {
    return items.map(item => {
      const inst = widgets.find(w => w.i === item.i)
      if (!inst) return item
      const def = getWidget(inst.type)
      if (!def) return item
      return { ...item, minW: def.minSize.w, minH: def.minSize.h }
    })
  }
  return { lg: enrich(layouts.lg), md: enrich(layouts.md), sm: enrich(layouts.sm) }
}
import { WidgetCatalogDrawer } from './widgets/widget-catalog-drawer'
import { Settings, Plus, RotateCcw, Check, X } from 'lucide-react'

// Trigger all registerWidget() side effects
import '@/components/widgets'

const MARGIN = 12
type Breakpoint = 'lg' | 'md' | 'sm'

function cleanLayout(items: readonly LayoutItem[] | undefined): LayoutItem[] {
  return (items ?? []).map(({ i, x, y, w, h, minW, minH, maxW, maxH, static: isStatic, isDraggable, isResizable, isBounded, resizeHandles }) => ({
    i,
    x,
    y,
    w,
    h,
    ...(minW != null ? { minW } : {}),
    ...(minH != null ? { minH } : {}),
    ...(maxW != null ? { maxW } : {}),
    ...(maxH != null ? { maxH } : {}),
    ...(isStatic != null ? { static: isStatic } : {}),
    ...(isDraggable != null ? { isDraggable } : {}),
    ...(isResizable != null ? { isResizable } : {}),
    ...(isBounded != null ? { isBounded } : {}),
    ...(resizeHandles != null ? { resizeHandles: [...resizeHandles] } : {}),
  }))
}

function cleanConfig(config: DashboardConfig): DashboardConfig {
  return {
    widgets: config.widgets.map(w => ({ ...w })),
    layouts: {
      lg: cleanLayout(config.layouts.lg),
      md: cleanLayout(config.layouts.md),
      sm: cleanLayout(config.layouts.sm),
    },
  }
}

export function ConfigurableDashboard() {
  const { userId, organizationId, role, userProfile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [savedConfig, setSavedConfig] = useState<DashboardConfig | null>(null)
  const [now, setNow] = useState(new Date())
  const [activeBreakpoint, setActiveBreakpoint] = useState<Breakpoint>('lg')

  // Measure container width so we can pass it to ResponsiveGridLayout
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading]) // re-run after loading→false so gridRef.current is in the DOM

  useEffect(() => {
    if (!userId) return
    async function init() {
      const stored = await loadLayout(userId!)
      const initial = cleanConfig(stored ?? getDefaultLayoutForRole(role))
      setConfig(initial)
      setSavedConfig(initial)
      setLoading(false)
    }
    init()
  }, [userId, role])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Enrich with minW/minH from registry (applied at render, not persisted)
  const enrichedLayouts = useMemo(() => {
    if (!config) return null
    return enrichLayouts(config.widgets, config.layouts)
  }, [config])

  // Fixed row height ensures content is always readable at any zoom level.
  // The grid container scrolls vertically when widgets extend below the viewport.
  const ROW_HEIGHT = 80

  const handleLayoutChange = useCallback((_layout: readonly LayoutItem[], allLayouts: Partial<Record<string, readonly LayoutItem[]>>) => {
    if (!editMode) return
    setConfig(prev => prev ? {
      ...prev,
      layouts: {
        lg: cleanLayout((allLayouts.lg as readonly LayoutItem[] | undefined) ?? prev.layouts.lg),
        md: cleanLayout((allLayouts.md as readonly LayoutItem[] | undefined) ?? prev.layouts.md),
        sm: cleanLayout((allLayouts.sm as readonly LayoutItem[] | undefined) ?? prev.layouts.sm),
      }
    } : prev)
  }, [editMode])

  const syncActiveLayout = useCallback((layout: readonly LayoutItem[]) => {
    if (!editMode) return
    setConfig(prev => prev ? {
      ...prev,
      layouts: {
        ...prev.layouts,
        [activeBreakpoint]: cleanLayout(layout),
      },
    } : prev)
  }, [activeBreakpoint, editMode])

  function handleRemoveWidget(instanceId: string) {
    setConfig(prev => {
      if (!prev) return prev
      return {
        widgets: prev.widgets.filter(w => w.i !== instanceId),
        layouts: {
          lg: prev.layouts.lg.filter(l => l.i !== instanceId),
          md: prev.layouts.md.filter(l => l.i !== instanceId),
          sm: prev.layouts.sm.filter(l => l.i !== instanceId),
        }
      }
    })
  }

  function handleAddWidget(instance: WidgetInstance, newLayouts: { lg: LayoutItem; md: LayoutItem; sm: LayoutItem }) {
    setConfig(prev => {
      if (!prev) return prev
      return {
        widgets: [...prev.widgets, instance],
        layouts: {
          lg: [...prev.layouts.lg, newLayouts.lg],
          md: [...prev.layouts.md, newLayouts.md],
          sm: [...prev.layouts.sm, newLayouts.sm],
        }
      }
    })
  }

  async function handleSave() {
    if (!userId || !organizationId || !config) return
    const nextConfig = cleanConfig(config)
    setSaving(true)
    try {
      await saveLayout(userId, organizationId, nextConfig)
      setConfig(nextConfig)
      setSavedConfig(nextConfig)
      setEditMode(false)
    } catch (e) {
      console.error('Failed to save layout', e)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setConfig(savedConfig ? cleanConfig(savedConfig) : savedConfig)
    setEditMode(false)
  }

  async function handleReset() {
    if (!userId) return
    try {
      await resetLayout(userId)
      const fresh = cleanConfig(getDefaultLayoutForRole(role))
      setConfig(fresh)
      setSavedConfig(fresh)
      setEditMode(false)
    } catch (e) {
      console.error('Failed to reset layout', e)
    }
  }

  if (loading || !config) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[13px] text-[#9994A8]">Loading dashboard…</div>
      </div>
    )
  }

  const currentWidgetTypes = config.widgets.map(w => w.type)
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const displayName = userProfile?.first_name || 'Admin User'
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-end justify-between gap-6 px-8 py-7 bg-[#ECECF1] shrink-0">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black tracking-tight text-slate-950">
            {greeting}, <span className="text-[#534AB7]">{displayName}!</span>
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600">Here&apos;s what&apos;s happening in your organization today.</p>
        </div>
        <div className="flex shrink-0 items-center gap-8">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Local Time
            </div>
            <div className="mt-1 font-mono text-3xl font-black text-[#534AB7]">{time}</div>
            <div className="text-sm font-medium text-slate-500">{date}</div>
          </div>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#534AB7] px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgba(83,74,183,0.28)] transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#534AB7' }}
            >
              <Settings size={13} />
              Customize
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowCatalog(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-black text-white transition-colors"
                style={{ backgroundColor: '#534AB7' }}
              >
                <Plus size={13} />
                Add Widget
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-black text-[#6B6578] hover:bg-[#F8F7F9] transition-colors border border-[#F1F0F4]"
              >
                <RotateCcw size={13} />
                Reset
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-black text-[#6B6578] hover:bg-[#F8F7F9] transition-colors border border-[#F1F0F4]"
              >
                <X size={13} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-black text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#059669' }}
              >
                <Check size={13} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      <div className={`overflow-hidden transition-all duration-200 ${editMode ? 'max-h-12' : 'max-h-0'} shrink-0`}>
        <div className="px-6 py-2 bg-[#F8F6FF] border-b border-[#E7E2FF]">
          <p className="text-[12px] font-bold text-[#534AB7] text-center">
            Drag to rearrange · Resize from corners · Click × to remove
          </p>
        </div>
      </div>

      {/* Grid — fills remaining height; rowHeight auto-calculated to fit */}
      <div ref={gridRef} className="flex-1 overflow-y-auto bg-[#ECECF1] px-4 pb-6">
        {config.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#F8F7F9] flex items-center justify-center mb-4">
              <Settings size={24} className="text-[#D1D5DB]" />
            </div>
            <p className="text-[14px] font-semibold text-[#9994A8]">No widgets yet</p>
            <p className="text-[12px] text-[#9994A8] mt-1">Click Customize then Add Widget to get started</p>
          </div>
        ) : containerWidth === 0 || !enrichedLayouts ? null : (
          <ResponsiveGridLayout
            className="layout"
            width={containerWidth}
            layouts={{
              lg: enrichedLayouts.lg,
              md: enrichedLayouts.md,
              sm: enrichedLayouts.sm,
            }}
            breakpoints={{ lg: 1200, md: 768, sm: 0 }}
            cols={{ lg: 12, md: 8, sm: 4 }}
            rowHeight={ROW_HEIGHT}
            dragConfig={{ enabled: editMode, handle: '.widget-drag-handle', cancel: 'button,a,input,select,textarea' }}
            resizeConfig={{ enabled: editMode, handles: ['se', 'e', 's'] }}
            onLayoutChange={handleLayoutChange}
            onDragStop={syncActiveLayout}
            onResizeStop={syncActiveLayout}
            onBreakpointChange={(bp) => setActiveBreakpoint((bp === 'md' || bp === 'sm' ? bp : 'lg') as Breakpoint)}
            margin={[MARGIN, MARGIN]}
          >
            {config.widgets.map((instance) => {
              const def = getWidget(instance.type)
              if (!def) {
                return (
                  <div key={instance.i} className="bg-[#FFF7F7] border border-dashed border-red-200 rounded-[12px] flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-[12px] font-semibold text-red-400">Widget unavailable</p>
                    {editMode && (
                      <button
                        onClick={() => handleRemoveWidget(instance.i)}
                        className="mt-2 text-[11px] text-red-400 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              }
              const WidgetComponent = def.component
              return (
                <div key={instance.i}>
                  <WidgetComponent
                    organizationId={organizationId ?? ''}
                    editMode={editMode}
                    onRemove={() => handleRemoveWidget(instance.i)}
                  />
                </div>
              )
            })}
          </ResponsiveGridLayout>
        )}
      </div>

      <WidgetCatalogDrawer
        open={showCatalog}
        currentWidgetTypes={currentWidgetTypes}
        currentLayouts={config.layouts}
        onAdd={handleAddWidget}
        onClose={() => setShowCatalog(false)}
      />
    </div>
  )
}
