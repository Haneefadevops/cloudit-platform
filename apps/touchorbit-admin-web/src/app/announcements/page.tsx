'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, AlertCircle, Info, AlertTriangle, RefreshCw, X, ChevronRight, Send, Megaphone } from 'lucide-react'
import { toast } from 'sonner'

interface Announcement {
  id: string
  title: string
  content: string
  priority: 'normal' | 'important' | 'urgent'
  created_at: string
}

interface AnnouncementFormData {
  title: string
  content: string
  priority: 'normal' | 'important' | 'urgent'
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
  const { organizationId, userId, isLoaded } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    priority: 'normal',
  })

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    const { error } = await supabase
      .from('announcements')
      .insert({
        organization_id: organizationId,
        author_id: userId,
        title: formData.title.trim(),
        content: formData.content.trim(),
        priority: formData.priority,
      })

    if (error) {
      toast.error('Failed to create announcement')
      return
    }

    toast.success('Announcement posted!')
    setShowForm(false)
    setFormData({ title: '', content: '', priority: 'normal' })
    loadAnnouncements()
  }

  async function handleDelete(announcementId: string) {
    if (!confirm('Are you sure?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', announcementId)
    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Announcement removed')
      loadAnnouncements()
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Company Announcements</h1>
            <p className="text-[11px] text-[#9CA3AF]">Broadcast news and updates to all employees</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={loadAnnouncements} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
             <button 
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
            >
              <Plus size={13} strokeWidth={3} />
              Post Update
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          {loading ? (
            <div className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Fetching Updates...</div>
          ) : announcements.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
               <Megaphone size={48} className="text-[#D1D5DB] mb-6 opacity-20" />
               <h3 className="text-lg font-black text-[#1A1727] uppercase tracking-widest mb-2">No Announcements</h3>
               <p className="text-[#9CA3AF] text-sm font-medium mb-8">Post your first organization-wide update</p>
               <button onClick={() => setShowForm(true)} className="px-6 py-2.5 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20">Create Announcement</button>
            </div>
          ) : (
            <div className="space-y-6">
              {announcements.map((item) => {
                const config = priorityConfig[item.priority]
                return (
                  <div key={item.id} className="bg-white rounded-[24px] p-6 border border-[#F1F0F4] shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: config.color + '15' }}>
                             <config.icon size={20} style={{ color: config.color }} strokeWidth={2.5} />
                          </div>
                          <div>
                             <div className="flex items-center gap-3">
                                <h3 className="text-[16px] font-black text-[#1A1727]">{item.title}</h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${config.badge}`}>
                                  {config.label}
                                </span>
                             </div>
                             <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mt-0.5">{formatDate(item.created_at)}</div>
                          </div>
                       </div>
                       <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 rounded-lg transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                    <div className="pl-14">
                       <p className="text-[#374151] text-[14px] leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Post Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">New Announcement</h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Update Title</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all" placeholder="What's happening?" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3 ml-1">Priority Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map(p => {
                       const c = priorityConfig[p]
                       const isS = formData.priority === p
                       return (
                         <button key={p} type="button" onClick={() => setFormData({...formData, priority: p})} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${isS ? 'border-[#534AB7] bg-purple-50 text-[#534AB7]' : 'border-[#F1F0F4] bg-[#F8F7F9] text-[#9CA3AF] hover:border-[#D1D5DB]'}`}>
                            <c.icon size={14} strokeWidth={3} /> {c.label}
                         </button>
                       )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Content / Message</label>
                  <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} rows={5} className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all resize-none" placeholder="Provide more details here..." />
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"><Send size={14} strokeWidth={3} /> Post Update</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
