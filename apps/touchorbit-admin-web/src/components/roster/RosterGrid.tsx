'use client'

import { AlertTriangle, Clock, EyeOff } from 'lucide-react'
import { OvertimeBar } from './OvertimeBar'

interface Employee {
  id: string
  first_name: string
  last_name: string
  department: string | null
}

interface ShiftTemplate {
  id: string
  name: string
}

interface RosterEntry {
  employee_id: string
  date: string | null
  shift_template_id: string | null
  shift_name: string | null
  start_time: string | null
  end_time: string | null
  acknowledgment_status?: string | null
  conflict_reason?: string | null
}

interface OvertimeRecord {
  employee_id: string
  date: string
}

interface AvailabilitySlot {
  employee_id: string
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_available: boolean
}

interface PreviewConflict {
  draft_id: string
  employee_id: string
  date: string
  conflict_type: string
  message: string
}

interface RosterGridProps {
  employees: Employee[]
  weekDays: Date[]
  rosterData: RosterEntry[]
  templates: ShiftTemplate[]
  overtimeRecords: OvertimeRecord[]
  availabilityData: AvailabilitySlot[]
  shiftColors: Record<string, { bg: string; border: string; text: string; light: string }>
  canEditRoster: boolean
  savingId: string | null
  onUpsert: (employeeId: string, date: string, shiftTemplateId: string | null) => void
  previewConflicts?: PreviewConflict[]
  weekStart?: string
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(time: string | null) {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function RosterGrid({
  employees,
  weekDays,
  rosterData,
  templates,
  overtimeRecords,
  availabilityData,
  shiftColors,
  canEditRoster,
  savingId,
  onUpsert,
  previewConflicts = [],
  weekStart,
}: RosterGridProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#F1F0F4] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F8F7F9]/50 border-b border-[#F1F0F4]">
            <th className="px-6 py-4 text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest sticky left-0 bg-[#F8F7F9] z-10 w-64 border-r border-[#F1F0F4]">Employee</th>
            {weekDays.map((day, idx) => (
              <th key={idx} className="px-4 py-4 text-center min-w-[140px]">
                <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-sm font-bold text-[#1A1727]">{day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F8F7F9]">
          {employees.map(emp => (
            <tr key={emp.id} className="hover:bg-[#F8F7F9]/50 transition-colors">
              <td className="px-6 py-4 sticky left-0 bg-white z-10 border-r border-[#F1F0F4]">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-[#1A1727]">{emp.first_name} {emp.last_name}</div>
                  {overtimeRecords.some(ot => ot.employee_id === emp.id && !rosterData.some(r => r.employee_id === emp.id && r.date === ot.date && r.shift_template_id !== null)) && (
                    <div className="group relative">
                      <AlertTriangle className="w-4 h-4 text-amber-500 cursor-help" />
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 w-48 bg-[#1A1727] text-white text-[10px] p-2 rounded shadow-lg font-bold uppercase tracking-wider">
                        ⚠ Unscheduled Overtime Found This Week
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{emp.department || 'No Dept'}</div>
                {weekStart && <OvertimeBar employeeId={emp.id} weekStart={weekStart} />}
              </td>
              {weekDays.map((day, idx) => {
                const dateStr = formatLocalDate(day)
                const entry = rosterData.find(r => r.employee_id === emp.id && r.date === dateStr)
                const isSaving = savingId === `${emp.id}-${dateStr}`
                const hasUnscheduledOT = overtimeRecords.some(ot => ot.employee_id === emp.id && ot.date === dateStr) && !entry?.shift_template_id
                const colors = entry?.shift_template_id ? shiftColors[entry.shift_template_id] : null
                const hasConflict = !!entry?.conflict_reason
                const ackStatus = entry?.acknowledgment_status
                const dayOfWeek = day.getDay()
                const empAvail = availabilityData.filter(a => a.employee_id === emp.id && a.day_of_week === dayOfWeek)
                const isUnavailable = empAvail.some(a => !a.is_available)
                const hasTimeRestriction = empAvail.some(a => a.is_available && (a.start_time || a.end_time))

                const previewConflict = previewConflicts.find(c => c.employee_id === emp.id && c.date === dateStr)

                return (
                  <td key={idx} className={`px-2 py-3 border-r border-[#F8F7F9] last:border-r-0 relative ${hasUnscheduledOT ? 'bg-amber-50/30' : ''}`}>
                    {/* Preview conflict stripes */}
                    {previewConflict && (
                      <div
                        className="absolute inset-0 pointer-events-none z-0 opacity-20"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #EF4444 4px, #EF4444 8px)',
                        }}
                      />
                    )}
                    <div className="space-y-1 relative z-10">
                      <select
                        disabled={isSaving || !canEditRoster}
                        value={entry?.shift_template_id || ''}
                        onChange={(e) => onUpsert(emp.id, dateStr, e.target.value || null)}
                        className={`w-full px-2 py-1.5 text-xs font-bold rounded-lg border focus:ring-2 outline-none transition-all ${
                          isSaving ? 'bg-[#F1F0F4] border-[#F1F0F4]' :
                          colors
                            ? `${colors.bg} ${colors.border} ${colors.text}`
                            : 'bg-[#F8F7F9] border-[#F8F7F9] text-[#9CA3AF]'
                        }`}
                      >
                        <option value="">Day Off</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {entry?.shift_template_id && (
                        <div className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-wider text-center flex items-center justify-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                        </div>
                      )}
                      {ackStatus && ackStatus !== 'acknowledged' && (
                        <div className={`text-[8px] font-black uppercase tracking-widest text-center ${
                          ackStatus === 'pending' ? 'text-amber-600' :
                          ackStatus === 'declined' ? 'text-red-600' : 'text-[#9CA3AF]'
                        }`}>
                          {ackStatus === 'pending' ? '⏳ Pending' : ackStatus === 'declined' ? '❌ Declined' : ackStatus}
                        </div>
                      )}
                      {hasConflict && (
                        <div className="text-[8px] font-black text-red-600 uppercase tracking-widest text-center" title={entry.conflict_reason ?? undefined}>
                          ⚠ {entry.conflict_reason}
                        </div>
                      )}
                      {previewConflict && (
                        <div className="text-[8px] font-black text-red-600 uppercase tracking-widest text-center" title={previewConflict.message}>
                          ⚠ {previewConflict.conflict_type.replace(/_/g, ' ')}
                        </div>
                      )}
                      {isUnavailable && (
                        <div className="text-[8px] font-black text-red-500 uppercase tracking-widest text-center flex items-center justify-center gap-0.5">
                          <EyeOff className="w-2.5 h-2.5" /> Unavailable
                        </div>
                      )}
                      {!isUnavailable && hasTimeRestriction && (
                        <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest text-center flex items-center justify-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> Time restricted
                        </div>
                      )}
                      {hasUnscheduledOT && (
                        <div className="text-[8px] font-black text-amber-600 uppercase tracking-widest text-center mt-1">
                          ⚠ Unscheduled OT
                        </div>
                      )}
                      {isSaving && (
                        <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest text-center animate-pulse">
                          Saving...
                        </div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
