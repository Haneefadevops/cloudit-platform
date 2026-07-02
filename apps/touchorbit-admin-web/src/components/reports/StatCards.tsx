'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'

export type StatTone = 'purple' | 'green' | 'amber' | 'red' | 'blue'

interface StatCard {
  label: string
  value: string | number
  tone: StatTone
  icon: LucideIcon
}

interface StatCardsProps {
  cards: StatCard[]
}

const toneMap: Record<StatTone, { gradient: string; iconBg: string; iconText: string; valueText: string }> = {
  purple: {
    gradient: 'from-[#F8F6FF] to-white',
    iconBg: 'bg-[#F1EEFF]',
    iconText: 'text-[#534AB7]',
    valueText: 'text-[#534AB7]',
  },
  green: {
    gradient: 'from-emerald-50 to-white',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    valueText: 'text-emerald-600',
  },
  amber: {
    gradient: 'from-amber-50 to-white',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    valueText: 'text-amber-600',
  },
  red: {
    gradient: 'from-red-50 to-white',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    valueText: 'text-red-600',
  },
  blue: {
    gradient: 'from-blue-50 to-white',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    valueText: 'text-blue-600',
  },
}

export function StatCards({ cards }: StatCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => {
        const t = toneMap[card.tone]
        const Icon = card.icon
        return (
          <div
            key={i}
            className={`relative overflow-hidden rounded-2xl border border-[#E5E3EA] bg-gradient-to-br ${t.gradient} p-5 transition-all hover:shadow-md`}
          >
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${t.iconBg} ${t.iconText}`}>
              <Icon size={18} strokeWidth={2.2} />
            </div>
            <p className={`text-[32px] font-black leading-none tracking-tight ${t.valueText}`}>
              {card.value}
            </p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#9994A8]">
              {card.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
