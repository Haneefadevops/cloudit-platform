'use client'

import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useNotifications } from '@/hooks/use-notifications'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  ChevronLeft,
  Trash2,
  Umbrella,
  Clock,
  Receipt,
  FileText,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  DollarSign,
  Megaphone,
  Calendar,
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react'

const typeMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  leave_submitted:         { icon: Umbrella,    color: '#3B82F6', bg: '#EFF6FF' },
  leave_approved:          { icon: Bell,        color: '#10B981', bg: '#ECFDF5' },
  leave_rejected:          { icon: AlertCircle, color: '#EF4444', bg: '#FFF5F5' },
  leave_cancellation_requested: { icon: AlertCircle, color: '#F59E0B', bg: '#FFFBEB' },
  overtime_submitted:      { icon: Clock,       color: '#F59E0B', bg: '#FFFBEB' },
  overtime_approved:       { icon: Bell,        color: '#10B981', bg: '#ECFDF5' },
  overtime_rejected:       { icon: AlertCircle, color: '#EF4444', bg: '#FFF5F5' },
  correction_submitted:    { icon: FileText,    color: '#3B82F6', bg: '#EFF6FF' },
  correction_approved:     { icon: Bell,        color: '#10B981', bg: '#ECFDF5' },
  correction_rejected:     { icon: AlertCircle, color: '#EF4444', bg: '#FFF5F5' },
  expense_submitted:       { icon: Receipt,     color: '#8B5CF6', bg: '#F5F3FF' },
  expense_approved:        { icon: Bell,        color: '#10B981', bg: '#ECFDF5' },
  expense_rejected:        { icon: AlertCircle, color: '#EF4444', bg: '#FFF5F5' },
  payroll_finalized:       { icon: DollarSign,  color: '#8B5CF6', bg: '#F5F3FF' },
  salary_revised:          { icon: TrendingUp,  color: '#10B981', bg: '#ECFDF5' },
  training_assigned:       { icon: GraduationCap, color: '#3B82F6', bg: '#EFF6FF' },
  announcement_posted:     { icon: Megaphone,   color: '#8B5CF6', bg: '#F5F3FF' },
  document_signed:         { icon: FileText,    color: '#3B82F6', bg: '#EFF6FF' },
  clock_flagged:           { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' },
  task_assigned:           { icon: ClipboardList, color: '#3B82F6', bg: '#EFF6FF' },
  task_reminder:           { icon: Clock,       color: '#F59E0B', bg: '#FFFBEB' },
  calendar_event_invited:  { icon: Calendar,    color: '#8B5CF6', bg: '#F5F3FF' },
  roster_published:        { icon: ClipboardList, color: '#3B82F6', bg: '#EFF6FF' },
  shift_swap_approved:     { icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' },
  shift_swap_rejected:     { icon: XCircle,     color: '#EF4444', bg: '#FFF5F5' },
  shift_conflict:          { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' },
  overtime_alert:          { icon: AlertCircle, color: '#EF4444', bg: '#FFF5F5' },
  coverage_low:            { icon: TrendingDown, color: '#EF4444', bg: '#FFF5F5' },
}

const routes: Record<string, string> = {
  leave_submitted: '/leave',
  leave_approved: '/leave',
  leave_rejected: '/leave',
  leave_cancellation_requested: '/leave',
  overtime_submitted: '/overtime',
  overtime_approved: '/overtime',
  overtime_rejected: '/overtime',
  correction_submitted: '/corrections',
  correction_approved: '/corrections',
  correction_rejected: '/corrections',
  expense_submitted: '/expenses',
  expense_approved: '/expenses',
  expense_rejected: '/expenses',
  document_signed: '/documents',
  salary_revised: '/payroll',
  training_assigned: '/training',
  payroll_finalized: '/payroll',
  announcement_posted: '/announcements',
  clock_flagged: '/attendance',
  calendar_event_invited: '/calendar',
  roster_published: '/roster',
  shift_swap_approved: '/roster',
  shift_swap_rejected: '/roster',
  shift_conflict: '/calendar',
  overtime_alert: '/overtime',
  coverage_low: '/calendar',
}

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications()

  const handleClick = async (n: any) => {
    if (!n.read) await markAsRead(n.id)
    const route = routes[n.type]
    if (route) router.push(route)
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-lg bg-[#F8F7F9] flex items-center justify-center text-[#9CA3AF] hover:text-[#1A1727] transition-colors"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-[15px] font-bold text-[#1A1727]">Notifications</h1>
              <p className="text-[11px] text-[#9CA3AF]">All your alerts and updates in one place</p>
            </div>
          </div>
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-[#534AB7] hover:text-[#1E1854] transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 text-center text-[#9CA3AF]">
              <div className="animate-spin w-8 h-8 border-4 border-[#534AB7] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm font-bold">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center px-6">
              <Bell className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#9CA3AF]">No notifications yet</p>
              <p className="text-xs text-[#D1D5DB] mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden divide-y divide-[#F1F0F4]">
              {notifications.map(n => {
                const meta = typeMeta[n.type] || { icon: Bell, color: '#9CA3AF', bg: '#F8F7F9' }
                const Icon = meta.icon
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-[#F8F7F9] ${n.read ? 'bg-transparent' : 'bg-white'}`}
                    style={{ borderLeft: n.read ? '3px solid transparent' : `3px solid ${meta.color}` }}
                  >
                    {/* Icon well */}
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: meta.bg }}>
                      <Icon size={18} style={{ color: meta.color }} strokeWidth={2} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className={`text-[13px] ${n.read ? 'font-semibold' : 'font-bold'} text-[#1A1727]`}>{n.title}</span>
                        <span className="text-[10px] text-[#9CA3AF] font-medium shrink-0">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[#9CA3AF] leading-relaxed">{n.message}</p>
                    </div>

                    {/* Unread dot or delete */}
                    {n.read ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id) }}
                        className="shrink-0 mt-1 p-1 text-[#D1D5DB] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: meta.color }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
