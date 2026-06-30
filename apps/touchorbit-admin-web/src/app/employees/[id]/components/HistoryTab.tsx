'use client'

import { User, Pencil, RefreshCcw, Upload, UserX, DollarSign, Calendar, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface HistoryEvent {
  id?: string
  event_type: string
  event_date: string
  description?: string
  details?: any
  changed_by_name?: string
}

interface HistoryTabProps {
  events: HistoryEvent[]
  isLoading: boolean
}

const EVENT_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string; dot: string }> = {
  employee_created: { icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  employee_updated: { icon: Pencil, color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  imported: { icon: Upload, color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  terminated: { icon: UserX, color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
  salary_revised: { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  leave_approved: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  default: { icon: RefreshCcw, color: 'text-[#6B6578]', bg: 'bg-[#F8F7F9]', dot: 'bg-[#9994A8]' },
}

function getEventConfig(eventType: string) {
  return EVENT_CONFIG[eventType] || EVENT_CONFIG.default
}

export function HistoryTab({ events, isLoading }: HistoryTabProps) {
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm animate-pulse h-64" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-12 shadow-sm text-center">
          <div className="w-14 h-14 bg-[#F8F7F9] rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock size={28} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[13px] font-bold text-[#9994A8]">No historical records found for this employee</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest mb-6 flex items-center gap-2">
          <RefreshCcw size={16} className="text-[#534AB7]" /> Employment & System History
        </h3>

        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-[#F1F0F4]" />

          <div className="space-y-5">
            {events.map((ev, i) => {
              const config = getEventConfig(ev.event_type)
              const Icon = config.icon
              const title = ev.event_type.replace(/_/g, ' ')
              const date = ev.event_date
                ? new Date(ev.event_date).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'

              return (
                <div key={i} className="relative flex items-start gap-4">
                  {/* Dot on timeline */}
                  <div
                    className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${config.dot}`}
                  >
                    <Icon size={12} className="text-white" />
                  </div>

                  {/* Card */}
                  <div className="flex-1 p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4] hover:border-[#534AB7]/20 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-[13px] font-black text-[#1A1727] uppercase tracking-tight">{title}</div>
                        <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mt-0.5">{date}</div>
                      </div>
                      <div
                        className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}
                      >
                        <Icon size={14} className={config.color} />
                      </div>
                    </div>

                    {ev.description && (
                      <p className="text-[12.5px] font-bold text-[#6B6578] leading-relaxed mb-2">
                        {ev.description}
                      </p>
                    )}

                    {ev.details && (
                      <p className="text-[11px] font-mono text-[#9994A8] bg-white rounded-lg p-2 border border-[#F1F0F4]">
                        {typeof ev.details === 'string' ? ev.details : JSON.stringify(ev.details)}
                      </p>
                    )}

                    {ev.changed_by_name && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-5 h-5 rounded-full bg-[#534AB7]/10 flex items-center justify-center text-[10px] font-black text-[#534AB7]">
                          {ev.changed_by_name.charAt(0)}
                        </div>
                        <span className="text-[10px] font-black text-[#534AB7] uppercase tracking-wider">
                          {ev.changed_by_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
