'use client'

import { Calendar, Clock, UserX, TrendingUp, ArrowRight } from 'lucide-react'
import type { ActivityEvent } from './ActivityTab'

interface RightPanelProps {
  firstName: string
  lastName: string
  jobTitle: string | null
  attendanceStats: { workDays: number; lateCount: number; absenceCount: number }
  activityEvents?: ActivityEvent[]
}

export function RightPanel({ firstName, lastName, jobTitle, attendanceStats, activityEvents }: RightPanelProps) {
  return (
    <aside className="w-80 shrink-0 bg-white border-l border-[#C7C3D0] overflow-y-auto">
      <div className="p-5 space-y-5">
        {/* Employee Quick Card */}
        <div className="bg-[#1A1727] rounded-2xl p-5 text-white relative overflow-hidden shadow-lg">
          <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">Employee</div>
          <div className="text-lg font-black tracking-tight mb-1">
            {firstName} {lastName}
          </div>
          <div className="text-[11px] font-bold text-white/50">
            {jobTitle}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
            <TrendingUp size={12} /> Active
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
          <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-1">This Month</h3>
          <p className="text-[10px] text-[#9994A8] font-bold mb-4">
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <div className="space-y-3">
            {[
              { label: 'Work Days', value: attendanceStats.workDays, icon: Calendar, color: '#534AB7' },
              { label: 'Late Arrivals', value: attendanceStats.lateCount, icon: Clock, color: '#F59E0B' },
              { label: 'Absences', value: attendanceStats.absenceCount, icon: UserX, color: '#EF4444' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center" style={{ color: s.color }}>
                    <s.icon size={14} />
                  </div>
                  <span className="text-[12px] font-bold text-[#6B6578]">{s.label}</span>
                </div>
                <span className="text-[14px] font-black text-[#1A1727]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
          <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-3">Recent Activity</h3>
          {(!activityEvents || activityEvents.length === 0) ? (
            <div className="text-[12px] font-semibold text-[#9994A8] text-center py-4">
              No recent activity
            </div>
          ) : (
            <div className="space-y-3">
              {activityEvents.slice(0, 5).map((ev, idx) => {
                const time = new Date(ev.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={`${ev.id}-${idx}`} className="flex items-start gap-3 group">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ev.iconBg}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${ev.iconColor.replace('text-', 'bg-')}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-[#1A1727] truncate">{ev.title}</div>
                      <div className="text-[10px] font-bold text-[#9994A8] truncate">{ev.description}</div>
                    </div>
                    <span className="text-[9px] font-black text-[#D1D5DB] uppercase tracking-widest shrink-0">{time}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
