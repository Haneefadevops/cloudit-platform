'use client'

import { Cake, Gift } from 'lucide-react'

interface BirthdayCardProps {
  name: string
  department: string
  age: number
  date: string
}

export function BirthdayCard({ name, department, age, date }: BirthdayCardProps) {
  return (
    <div className="p-4 bg-pink-50 rounded-[20px] border border-pink-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600">
          <Cake size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-[#1A1727] truncate">{name}</div>
          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-tighter">{department}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-black text-pink-600">Turns {age}</div>
          <div className="text-[10px] font-bold text-[#9CA3AF]">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
        </div>
      </div>
    </div>
  )
}

export function MiniBirthdayBadge({ name }: { name: string }) {
  return (
    <div className="group relative inline-flex items-center gap-1 px-2 py-0.5 bg-pink-100 text-pink-700 rounded-lg text-[9px] font-black uppercase tracking-tighter">
      <Cake size={10} />
      {name}
    </div>
  )
}
