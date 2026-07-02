'use client'

import {
  Clock, Calendar, DollarSign, TrendingUp, Star, Zap,
  Briefcase, User, Pencil, CheckCircle, XCircle, ArrowRight,
  MapPin, Shield, Award, FileText, Phone, Upload
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Clock, Calendar, DollarSign, TrendingUp, Star, Zap,
  Briefcase, User, Pencil, CheckCircle, XCircle, ArrowRight,
  MapPin, Shield, Award, FileText, Phone, Upload
}

export interface ActivityEvent {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  iconName: string
  iconColor: string
  iconBg: string
}

interface ActivityTabProps {
  events: ActivityEvent[]
  isLoading: boolean
}

function groupByDate(events: ActivityEvent[]) {
  const groups: Record<string, ActivityEvent[]> = {}
  events.forEach((ev) => {
    const date = new Date(ev.timestamp).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(ev)
  })
  return groups
}

export function ActivityTab({ events, isLoading }: ActivityTabProps) {
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-pulse font-black text-[#D1D5DB] uppercase tracking-widest text-[10px]">
        Loading activity feed...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-[#C7C3D0] p-12 text-center">
        <div className="w-14 h-14 bg-[#F8F7F9] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <TrendingUp size={24} className="text-[#D1D5DB]" />
        </div>
        <p className="text-[13px] font-bold text-[#9CA3AF]">No activity recorded yet</p>
      </div>
    )
  }

  const grouped = groupByDate(events)
  const dates = Object.keys(grouped)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <TrendingUp size={16} className="text-[#534AB7]" /> Activity Timeline
          </h3>
          <p className="text-[11px] text-[#9994A8] font-bold mt-1">{events.length} event{events.length !== 1 ? 's' : ''} across all systems</p>
        </div>
      </div>

      <div className="space-y-6">
        {dates.map((date) => (
          <div key={date} className="relative">
            <div className="sticky top-0 z-10 mb-3">
              <span className="inline-block px-3 py-1 bg-[#1A1727] text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                {date}
              </span>
            </div>
            <div className="space-y-3">
              {grouped[date].map((ev, idx) => {
                const Icon = ICON_MAP[ev.iconName] || TrendingUp
                const time = new Date(ev.timestamp).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <div
                    key={`${ev.id}-${idx}`}
                    className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-[#C7C3D0] shadow-sm hover:shadow-md hover:border-[#534AB7]/20 transition-all group"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ev.iconBg}`}
                    >
                      <Icon size={18} className={ev.iconColor} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-black text-[#1A1727]">{ev.title}</div>
                          <p className="text-[12px] font-bold text-[#6B6578] mt-0.5 leading-relaxed">
                            {ev.description}
                          </p>
                        </div>
                        <span className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest shrink-0">
                          {time}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
