'use client'

import { X } from 'lucide-react'
import { getAllWidgets } from '@/lib/widgets/registry'
import type { WidgetDefinition, WidgetType } from '@/lib/widgets/types'
import type { LayoutItem } from 'react-grid-layout'

interface CatalogItem extends WidgetDefinition {
  available: boolean
}

interface Props {
  open: boolean
  currentWidgetTypes: WidgetType[]
  currentLayouts: { lg: LayoutItem[]; md: LayoutItem[]; sm: LayoutItem[] }
  onAdd: (instance: { i: string; type: WidgetType }, layouts: { lg: LayoutItem; md: LayoutItem; sm: LayoutItem }) => void
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  people: 'People',
  finance: 'Finance',
  comms: 'Communications',
}

function overlaps(a: LayoutItem, b: LayoutItem) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function findOpenSlot(layout: LayoutItem[], cols: number, w: number, h: number): Pick<LayoutItem, 'x' | 'y'> {
  const width = Math.min(w, cols)
  const maxY = layout.reduce((m, item) => Math.max(m, item.y + item.h), 0)

  for (let y = 0; y <= maxY + h; y++) {
    for (let x = 0; x <= cols - width; x++) {
      const candidate = { i: '__candidate__', x, y, w: width, h }
      if (!layout.some(item => overlaps(candidate, item))) {
        return { x, y }
      }
    }
  }

  return { x: 0, y: maxY }
}

export function WidgetCatalogDrawer({ open, currentWidgetTypes, currentLayouts, onAdd, onClose }: Props) {
  const all = getAllWidgets()
  const added = new Set(currentWidgetTypes)

  const byCategory: Record<string, CatalogItem[]> = {}
  for (const def of all) {
    if (!byCategory[def.category]) byCategory[def.category] = []
    byCategory[def.category].push({ ...def, available: !added.has(def.type) })
  }

  function handleAdd(def: WidgetDefinition) {
    const id = `w-${Math.random().toString(36).substr(2, 9)}`

    const lgW = Math.min(def.defaultSize.w, 12)
    const mdW = Math.min(def.defaultSize.w, 8)
    const smW = 4
    const lgSlot = findOpenSlot(currentLayouts.lg, 12, lgW, def.defaultSize.h)
    const mdSlot = findOpenSlot(currentLayouts.md, 8, mdW, def.defaultSize.h)
    const smSlot = findOpenSlot(currentLayouts.sm, 4, smW, def.defaultSize.h)

    const lgLayout: LayoutItem = { i: id, ...lgSlot, w: lgW, h: def.defaultSize.h, minW: def.minSize.w, minH: def.minSize.h }
    const mdLayout: LayoutItem = { i: id, ...mdSlot, w: mdW, h: def.defaultSize.h, minW: Math.min(def.minSize.w, 8), minH: def.minSize.h }
    const smLayout: LayoutItem = { i: id, ...smSlot, w: smW, h: def.defaultSize.h, minW: Math.min(def.minSize.w, 4), minH: def.minSize.h }

    onAdd({ i: id, type: def.type }, { lg: lgLayout, md: mdLayout, sm: smLayout })
    onClose()
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-[360px] bg-white flex flex-col transition-transform duration-300 ease-in-out`}
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-8px 0 32px rgba(26,23,39,0.12)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F0F4] shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1727]">Add Widget</h2>
            <p className="text-[11px] text-[#9994A8] mt-0.5">Choose widgets to add to your dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F8F7F9] transition-colors"
          >
            <X size={16} className="text-[#6B6578]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9994A8] mb-3">
                {CATEGORY_LABELS[cat] || cat}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.type}
                    className={`rounded-[12px] p-4 border transition-colors ${
                      item.available
                        ? 'border-[#F1F0F4] bg-white'
                        : 'border-[#F1F0F4] bg-[#F8F7F9] opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1A1727]">{item.title}</p>
                        <p className="text-[11px] text-[#9994A8] mt-0.5 leading-relaxed">{item.description}</p>
                      </div>
                      {item.available ? (
                        <button
                          onClick={() => handleAdd(item)}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white transition-colors"
                          style={{ backgroundColor: '#534AB7' }}
                        >
                          Add
                        </button>
                      ) : (
                        <span className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#9994A8] bg-[#F1F0F4]">
                          Added
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
