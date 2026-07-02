'use client'

import { LayoutGrid, Table2, List } from 'lucide-react'

export type ViewMode = 'grid' | 'table' | 'compact'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

const modes: { id: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { id: 'grid', icon: LayoutGrid, label: 'Grid' },
  { id: 'table', icon: Table2, label: 'Table' },
  { id: 'compact', icon: List, label: 'Compact' },
]

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex bg-[#E3E2EA] rounded-xl p-1 gap-1 border border-[#C7C3D0] shadow-sm">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            value === m.id
              ? 'bg-white text-[#534AB7] shadow-sm'
              : 'text-[#6B6578] hover:text-[#1A1727]'
          }`}
          title={m.label}
        >
          <m.icon size={14} />
        </button>
      ))}
    </div>
  )
}
