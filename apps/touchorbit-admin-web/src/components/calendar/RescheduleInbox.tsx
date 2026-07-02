'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PillBadge, EmptyState } from '@/components/ui-touchorbit'
import { Check, X, CalendarDays, Clock, AlertTriangle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RescheduleRequest {
  id: string
  event_id: string
  event_title: string
  event_date: string
  employee_name: string
  proposed_new_start: string
  proposed_new_end: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface RescheduleInboxProps {
  className?: string
}

export function RescheduleInbox({ className }: RescheduleInboxProps) {
  const { organizationId } = useAuth()
  const [requests, setRequests] = useState<RescheduleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  useEffect(() => {
    if (!organizationId) return
    loadRequests()
  }, [organizationId])

  async function loadRequests() {
    setLoading(true)
    try {
      // Mock data until backend is ready
      const mock: RescheduleRequest[] = [
        {
          id: 'mock-1',
          event_id: 'evt-1',
          event_title: 'Q3 Strategy Meeting',
          event_date: '2026-06-15T10:00:00Z',
          employee_name: 'John Smith',
          proposed_new_start: '2026-06-16T14:00:00Z',
          proposed_new_end: '2026-06-16T15:30:00Z',
          reason: 'Conflict with client call',
          status: 'pending',
          created_at: '2026-06-10T09:00:00Z',
        },
        {
          id: 'mock-2',
          event_id: 'evt-2',
          event_title: 'Team Standup',
          event_date: '2026-06-12T09:00:00Z',
          employee_name: 'Sarah Lee',
          proposed_new_start: '2026-06-12T10:00:00Z',
          proposed_new_end: '2026-06-12T10:30:00Z',
          reason: 'Running late due to commute',
          status: 'pending',
          created_at: '2026-06-11T08:30:00Z',
        },
      ]
      setRequests(mock)
    } finally {
      setLoading(false)
    }
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  function handleApprove(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r))
  }

  function handleReject(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r))
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={cn('bg-white rounded-[32px] border border-[#F1F0F4] shadow-xl shadow-purple-900/5 overflow-hidden', className)}>
      <div className="p-6 border-b border-[#F1F0F4] bg-[#F8F7F9]/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-[#1A1727]">Reschedule Requests</h3>
            <p className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest mt-0.5">Pending employee requests</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500">
            <CalendarDays size={16} />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {([
            { id: 'pending' as const, label: `Pending (${counts.pending})`, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { id: 'approved' as const, label: `Approved (${counts.approved})`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { id: 'rejected' as const, label: `Rejected (${counts.rejected})`, color: 'text-red-700 bg-red-50 border-red-200' },
            { id: 'all' as const, label: `All (${counts.all})`, color: 'text-gray-700 bg-gray-50 border-gray-200' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all',
                filter === tab.id ? tab.color : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#F8F7F9] rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No requests" description={`No ${filter === 'all' ? '' : filter} reschedule requests.`} className="py-12" />
        ) : (
          <div className="divide-y divide-[#F1F0F4]">
            {filtered.map(req => (
              <div key={req.id} className="p-4 hover:bg-[#F8F7F9]/50 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PillBadge status={req.status} className="text-[9px] px-1.5">{req.status}</PillBadge>
                      <span className="text-xs font-bold text-[#1A1727] truncate">{req.event_title}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#9CA3AF] font-medium mb-1">
                      <User size={10} />
                      {req.employee_name}
                      <span className="mx-1">·</span>
                      <Clock size={10} />
                      {formatDateTime(req.created_at)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="px-2 py-1 bg-red-50 border border-red-100 rounded-lg text-[10px] font-bold text-red-600 line-through">
                        {formatDateTime(req.event_date)}
                      </div>
                      <span className="text-[10px] text-[#D1D5DB]">→</span>
                      <div className="px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] font-bold text-emerald-600">
                        {formatDateTime(req.proposed_new_start)}
                      </div>
                    </div>
                    {req.reason && (
                      <div className="flex items-start gap-1 mt-2 text-[11px] text-[#6B7280]">
                        <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                        {req.reason}
                      </div>
                    )}
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex-1 py-2 bg-red-50 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-1.5"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
