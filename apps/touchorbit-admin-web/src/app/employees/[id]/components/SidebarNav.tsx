'use client'

import {
  User, Briefcase, CreditCard, DollarSign, Clock, Calendar,
  FileText, Phone, Shield, RefreshCcw, Zap, Star, TrendingUp
} from 'lucide-react'

export const TABS = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'bank', label: 'Bank', icon: CreditCard },
  { id: 'salary', label: 'Salary', icon: DollarSign },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'leave', label: 'Leave', icon: Calendar },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'performance', label: 'Performance', icon: Star },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'emergency', label: 'Emergency', icon: Phone },
  { id: 'app-access', label: 'App Access', icon: Shield },
  { id: 'activity', label: 'Activity', icon: TrendingUp },
  { id: 'history', label: 'History', icon: RefreshCcw },
] as const

export type TabId = typeof TABS[number]['id']

interface SidebarNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  return (
    <nav className="w-60 shrink-0 bg-white border-r border-[#C7C3D0] flex flex-col overflow-y-auto">
      <div className="p-4 space-y-1">
        {TABS.map((t) => {
          const isActive = activeTab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all text-left ${
                isActive
                  ? 'bg-[#F3E8FF] text-[#534AB7]'
                  : 'text-[#6B6578] hover:bg-[#F8F7F9] hover:text-[#1A1727]'
              }`}
            >
              <Icon size={16} strokeWidth={2.5} />
              {t.label}
              {isActive && (
                <span className="ml-auto w-1 h-1 rounded-full bg-[#534AB7]" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
