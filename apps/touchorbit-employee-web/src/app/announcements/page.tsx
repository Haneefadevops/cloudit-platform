'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Megaphone, Info, AlertCircle, AlertTriangle, ChevronRight, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface Announcement {
  id: string
  title: string
  content: string
  priority: 'normal' | 'important' | 'urgent'
  created_at: string
}

const priorityConfig = {
  normal: {
    label: 'Normal',
    icon: Info,
    color: '#3B82F6',
    badge: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  important: {
    label: 'Important',
    icon: AlertCircle,
    color: '#D97706',
    badge: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    color: '#EF4444',
    badge: 'bg-red-50 text-red-600 border-red-100',
  },
}

export default function AnnouncementsPage() {
  const { organizationId, isLoaded } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadAnnouncements()
    }
  }, [isLoaded, organizationId])

  async function loadAnnouncements() {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load announcements')
    } else {
      setAnnouncements(data || [])
    }
    setLoading(false)
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <EmployeeLayout showGreeting={false} title="Announcements">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">Company Updates</span>
            <Megaphone className="text-white/60" size={20} />
          </div>
          <div className="bg-white/10 rounded-2xl p-4 border border-white/5">
            <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Total Announcements</div>
            <div className="text-2xl font-black text-white">{announcements.length}</div>
          </div>
        </div>

        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
            {loading ? (
              <div className="py-20 text-center text-[#9CA3AF] animate-pulse font-bold uppercase tracking-widest text-[10px]">Loading Updates...</div>
            ) : announcements.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <Megaphone size={40} className="text-[#D1D5DB] mb-4 opacity-20" />
                <div className="text-sm font-bold text-[#9CA3AF]">No announcements yet</div>
              </div>
            ) : (
              <div className="space-y-6">
                {announcements.map((item) => {
                  const config = priorityConfig[item.priority] || priorityConfig.normal
                  return (
                    <div key={item.id} className="bg-[#F8F7F9] rounded-2xl p-5 border border-[#F1F0F4] group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: config.color + '15' }}>
                            <config.icon size={16} style={{ color: config.color }} strokeWidth={2.5} />
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${config.badge}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="text-[9px] text-[#9CA3AF] font-bold uppercase tracking-widest">{formatDate(item.created_at)}</div>
                      </div>
                      <h3 className="text-[15px] font-black text-[#1A1727] mb-2">{item.title}</h3>
                      <p className="text-[#374151] text-[13px] leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </EmployeeLayout>
  )
}
