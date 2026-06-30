'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GripVertical, X, MoreVertical } from 'lucide-react'

// Size tier based on the content area height in pixels
export type WidgetSize = 'xs' | 'sm' | 'md' | 'lg'
const WidgetSizeCtx = createContext<WidgetSize>('md')
export function useWidgetSize(): WidgetSize { return useContext(WidgetSizeCtx) }

// Thresholds calibrated for rowHeight=80, margin=12, title-bar ~46px:
//   h=1 → content ~34px   → xs
//   h=2 → content ~126px  → sm
//   h=3 → content ~218px  → md
//   h=4 → content ~310px  → lg
function deriveSize(w: number, h: number): WidgetSize {
  if (w < 240 || h < 90) return 'xs'
  if (w < 360 || h < 180) return 'sm'
  if (w < 520 || h < 280) return 'md'
  return 'lg'
}

interface WidgetShellProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  tone?: 'purple' | 'green' | 'amber' | 'blue' | 'red' | 'sky' | 'violet' | 'orange' | 'gray'
  editMode: boolean
  onRemove: () => void
  children: React.ReactNode
  loading?: boolean
  onRefresh?: () => void
}

export function WidgetShell({
  title,
  subtitle,
  icon: Icon,
  tone = 'purple',
  editMode,
  onRemove,
  children,
  loading = false,
  onRefresh,
}: WidgetShellProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<WidgetSize>('md')

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize(deriveSize(entry.contentRect.width, entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tones = {
    purple: 'bg-[#534AB7]/10 text-[#534AB7]',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
    orange: 'bg-orange-100 text-orange-700',
    gray: 'bg-slate-100 text-slate-600',
  }

  return (
    <div
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.10)] transition-all duration-200 ${
        editMode
          ? 'ring-2 ring-[#534AB7]/30 ring-dashed ring-offset-1 cursor-grab active:cursor-grabbing'
          : 'hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(26,23,39,0.09)]'
      }`}
    >
      {/* Title bar */}
      <div className={`widget-drag-handle flex items-start justify-between px-5 pt-5 shrink-0 select-none ${editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        <div className="flex min-w-0 items-center gap-3">
          {editMode && (
            <span className="drag-handle text-[#D0CDD8] hover:text-[#9994A8] transition-colors">
              <GripVertical size={14} />
            </span>
          )}
          {Icon && (
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
              <Icon size={20} strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-950">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!editMode && !onRefresh && (
            <MoreVertical size={14} className="text-[#C7C3D0]" />
          )}
          {!editMode && onRefresh && (
            <button
              onClick={onRefresh}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Refresh widget"
            >
              <MoreVertical size={18} />
            </button>
          )}
          {editMode && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-[#9994A8] hover:text-red-500 hover:bg-red-50 transition-all"
              aria-label="Remove widget"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content — overflow-hidden so widgets clip cleanly at any size */}
      <div ref={contentRef} className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="h-full p-4 animate-pulse">
            <div className="mb-5 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-20 rounded-lg bg-[#F1F0F4]" />
                <div className="h-2.5 w-28 rounded-full bg-[#F1F0F4]" />
              </div>
              <div className="h-11 w-11 rounded-full bg-[#F1F0F4]" />
            </div>
            <div className="space-y-3">
              <div className="h-3 rounded-full bg-[#F1F0F4]" />
              <div className="h-3 w-4/5 rounded-full bg-[#F1F0F4]" />
              <div className="h-3 w-2/3 rounded-full bg-[#F1F0F4]" />
            </div>
          </div>
        ) : (
          <WidgetSizeCtx.Provider value={size}>
            <div className="h-full flex flex-col">
              {children}
            </div>
          </WidgetSizeCtx.Provider>
        )}
      </div>
    </div>
  )
}
