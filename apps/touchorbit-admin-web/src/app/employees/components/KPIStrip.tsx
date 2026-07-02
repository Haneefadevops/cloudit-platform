'use client'

import { Users, UserCheck, Umbrella, UserX } from 'lucide-react'

interface KPIStripProps {
  stats: { total: number; active: number; onLeave: number; terminated: number }
  activeFilter: string
  onFilter: (filter: string) => void
}

const items = [
  { id: 'all', label: 'Total Employees', valueKey: 'total' as const, icon: Users, color: '#534AB7', dot: 'bg-[#534AB7]' },
  { id: 'active', label: 'Active', valueKey: 'active' as const, icon: UserCheck, color: '#10B981', dot: 'bg-emerald-500' },
  { id: 'on_leave', label: 'On Leave', valueKey: 'onLeave' as const, icon: Umbrella, color: '#2563EB', dot: 'bg-blue-500' },
  { id: 'terminated', label: 'Terminated', valueKey: 'terminated' as const, icon: UserX, color: '#9994A8', dot: 'bg-[#C7C3D0]' },
]

export function KPIStrip({ stats, activeFilter, onFilter }: KPIStripProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => {
        const isActive = activeFilter === item.id
        const value = stats[item.valueKey]
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => onFilter(isActive ? 'all' : item.id)}
            className={`group relative flex flex-col items-start justify-center rounded-xl border px-4 py-3 transition-all shadow-sm text-left ${
              isActive
                ? 'bg-white border-[#534AB7]/40 ring-2 ring-[#534AB7]/10'
                : 'bg-[#F4F3F7] border-[#C7C3D0] hover:bg-white'
            }`}
          >
            <div className="w-full truncate text-[9px] font-black text-[#6B6578] uppercase tracking-widest mb-1 group-hover:text-[#534AB7]">
              {item.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-[#1A1727]">{value}</span>
              <Icon size={14} style={{ color: item.color }} strokeWidth={2.5} />
            </div>
            {isActive && (
              <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#534AB7] rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
