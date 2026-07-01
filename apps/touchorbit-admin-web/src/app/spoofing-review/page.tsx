'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { 
  ShieldAlert, 
  Search, 
  MapPin, 
  ExternalLink, 
  ChevronRight, 
  X, 
  Download, 
  RefreshCw,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Smartphone,
  Globe,
  Navigation
} from 'lucide-react'
import { toast } from 'sonner'
import { exportSpoofingToCSV } from '@/lib/spoofing/csv-export'

interface Employee {
  id: string
  first_name: string
  last_name: string
  job_title: string | null
  department: string | null
  photo_url: string | null
}

interface FlaggedEvent {
  id: string
  employee_id: string
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
  latitude: number
  longitude: number
  gps_accuracy: number
  selfie_url: string
  suspicious_flags: string[]
  admin_review_status: 'flagged' | 'approved' | 'rejected'
  admin_notes: string
  client_ip: string | null
  ip_city: string | null
  ip_country: string | null
  ip_distance_km: number | null
  ip_check_status: string
  device_info: string
  timezone_offset: number
  device_fingerprint: any
  work_type: string
  employee_name?: string
  employee?: {
    first_name: string
    last_name: string
    job_title: string
    department: string
    photo_url?: string | null
  }
}

const FLAG_LABELS: Record<string, string> = {
  ip_distance_mismatch: 'IP/GPS mismatch',
  ip_proxy_detected: 'VPN/Proxy',
  low_variance: 'Identical samples',
  accuracy_too_precise: 'Too precise',
  accuracy_too_imprecise: 'Too imprecise',
  accuracy_too_stable: 'Stable accuracy',
  teleportation: 'Teleportation',
  outside_geofence: 'Outside geofence',
  timezone_mismatch: 'Timezone mismatch',
  mock_location_api_legacy: 'Mock API',
}

const FLAG_COLORS: Record<string, { bg: string; text: string }> = {
  ip_distance_mismatch:     { bg: 'bg-red-50',     text: 'text-red-700' },
  teleportation:            { bg: 'bg-red-50',     text: 'text-red-700' },
  ip_proxy_detected:        { bg: 'bg-orange-50',  text: 'text-orange-700' },
  low_variance:             { bg: 'bg-amber-50',   text: 'text-amber-700' },
  accuracy_too_precise:     { bg: 'bg-amber-50',   text: 'text-amber-700' },
  accuracy_too_imprecise:   { bg: 'bg-amber-50',   text: 'text-amber-700' },
  accuracy_too_stable:      { bg: 'bg-amber-50',   text: 'text-amber-700' },
  outside_geofence:         { bg: 'bg-gray-50',    text: 'text-gray-700' },
  timezone_mismatch:        { bg: 'bg-gray-50',    text: 'text-gray-700' },
  mock_location_api_legacy: { bg: 'bg-purple-50',  text: 'text-purple-700' },
}

export default function SpoofingReviewPage() {
  const { organizationId, isLoaded } = useAuth()
  const [events, setEvents] = useState<FlaggedEvent[]>([])
  const [employees, setEmployees] = useState<Record<string, Employee>>({})
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('flagged')
  const [filterFlag, setFilterFlag] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<FlaggedEvent | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [recentPunches, setRecentPunches] = useState<any[]>([])

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadData()
    }
  }, [isLoaded, organizationId])

  useEffect(() => {
    if (selected) {
      loadRecentPunches(selected.employee_id)
      setReviewNote(selected.admin_notes || '')
    }
  }, [selected])

  async function loadEmployees() {
    const result = await api.get<any[]>(`/employees?limit=500`)
    if (!result.ok) {
      console.error('Error loading employees:', result.error)
      return
    }
    const map: Record<string, Employee> = {}
    for (const e of result.data || []) {
      map[e.id] = e
    }
    setEmployees(map)
  }

  async function loadData() {
    setLoading(true)
    try {
      const [eventsResult, employeesResult] = await Promise.all([
        api.get<any[]>('/attendance?limit=500'),
        api.get<any[]>(`/employees?limit=500`),
      ])

      if (!eventsResult.ok) throw new Error(eventsResult.error || 'Failed to load events')
      if (!employeesResult.ok) throw new Error(employeesResult.error || 'Failed to load employees')

      const empMap: Record<string, Employee> = {}
      for (const e of employeesResult.data || []) {
        empMap[e.id] = e
      }
      setEmployees(empMap)

      setEvents((eventsResult.data || []).map((e: any) => ({
        ...e,
        employee: e.employee_id ? empMap[e.employee_id] : undefined,
      })))
    } catch (e) {
      console.error('Error loading spoofing data:', e)
      toast.error('Failed to load suspicious punches')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecentPunches(employeeId: string) {
    const result = await api.get<any[]>(`/attendance?employee_id=${employeeId}&limit=5`)
    if (!result.ok) {
      console.error('Error loading recent punches:', result.error)
      setRecentPunches([])
      return
    }
    setRecentPunches(result.data || [])
  }

  async function handleReview(status: 'approved' | 'rejected') {
    if (!selected) return
    setProcessingId(selected.id)
    try {
      const result = await api.post<any>(`/attendance/clock-events/${selected.id}/review`, {
        status,
        reviewNotes: reviewNote || undefined,
      })

      if (!result.ok) throw new Error(result.error || 'Review failed')
      
      toast.success(`Punch ${status} successfully`)
      setSelected(null)
      loadData()
    } catch (e: any) {
      console.error('Error reviewing event:', e)
      toast.error(e.message || 'Failed to update review status')
    } finally {
      setProcessingId(null)
    }
  }

  function handleExport() {
    const exportData = filtered.map(e => ({
      timestamp: e.timestamp,
      employee_name: e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : (e.employee_name || 'Unknown'),
      latitude: e.latitude,
      longitude: e.longitude,
      gps_accuracy: e.gps_accuracy,
      ip_address: e.client_ip,
      ip_city: e.ip_city,
      ip_country: e.ip_country,
      ip_distance_km: e.ip_distance_km,
      suspicious_flags: e.suspicious_flags,
      status: e.admin_review_status,
      reviewed_by: '', // RPC handles this in DB, we don't have it in the view easily without joining users
      review_notes: e.admin_notes,
      selfie_url: e.selfie_url
    }))
    exportSpoofingToCSV(exportData)
  }

  const filtered = events.filter(e => {
    const matchesStatus = filterStatus === 'all' ? true : e.admin_review_status === filterStatus
    const matchesFlag = filterFlag === 'all' ? true : e.suspicious_flags?.includes(filterFlag)
    const employeeName = e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : (e.employee_name || '')
    const matchesSearch = searchQuery === '' ? true : 
      employeeName.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Only show events that are actually flagged or have been reviewed (don't show verified ones unless 'all' status)
    const hasFlags = (e.suspicious_flags?.length ?? 0) > 0
    
    return matchesStatus && matchesFlag && matchesSearch && (hasFlags || filterStatus !== 'flagged')
  })

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9] font-['Plus_Jakarta_Sans']">
        
        {/* Top Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-6 shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black text-[#1A1727] tracking-tight flex items-center gap-2">
                <ShieldAlert className="text-red-500" size={28} />
                Suspicious Punches
              </h1>
              <p className="text-[#9CA3AF] text-sm font-medium">Review flagged clock-ins for potential GPS spoofing</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#F1F0F4] text-[#1A1727] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F8F7F9] transition-all"
              >
                <Download size={14} /> Export CSV
              </button>
              <button 
                onClick={loadData}
                className="p-2.5 bg-[#F8F7F9] text-[#534AB7] rounded-xl hover:bg-[#F1F0F4] transition-all"
              >
                <RefreshCw size={20} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex bg-[#F1F0F4] rounded-xl p-1 gap-1">
              {[
                { id: 'flagged', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'all', label: 'All' },
              ].map(f => (
                <button 
                  key={f.id} 
                  onClick={() => setFilterStatus(f.id)} 
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filterStatus === f.id ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select 
              value={filterFlag} 
              onChange={e => setFilterFlag(e.target.value)}
              className="bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl px-4 py-2 text-[11px] font-black text-[#1A1727] uppercase tracking-wider outline-none focus:ring-2 focus:ring-[#534AB7]/10"
            >
              <option value="all">All Flags</option>
              {Object.entries(FLAG_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
              <input 
                type="text" 
                placeholder="Search employee..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-[12px] font-bold text-[#1A1727] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#534AB7]/10"
              />
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-hidden flex divide-x divide-[#F1F0F4]">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white border-b border-[#F1F0F4] z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Time</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Employee</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest text-center">Loc</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest text-center">Selfie</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Flags</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest text-center">IP Distance</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F7F9] bg-white text-[13px]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center font-bold text-[#D1D5DB] animate-pulse">Loading suspicious activity data...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center flex flex-col items-center justify-center gap-3 opacity-30">
                      <ShieldAlert size={48} className="text-[#D1D5DB]" />
                      <p className="text-[14px] font-black text-[#1A1727] uppercase tracking-widest">No matching results found</p>
                    </td>
                  </tr>
                ) : filtered.map(e => (
                  <tr 
                    key={e.id} 
                    onClick={() => setSelected(e)}
                    className={`hover:bg-[#F8F7F9] cursor-pointer transition-all ${selected?.id === e.id ? 'bg-[#F3E8FF] ring-1 ring-inset ring-[#534AB7]/20' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-extrabold text-[#1A1727]">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[11px] font-bold text-[#9CA3AF] truncate" title={new Date(e.timestamp).toLocaleString()}>
                        {new Date(e.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#F1F0F4] overflow-hidden flex items-center justify-center font-black text-[#9CA3AF] shrink-0 border border-white shadow-sm">
                          {e.employee?.photo_url ? (
                            <img src={e.employee.photo_url} className="w-full h-full object-cover" />
                          ) : e.employee?.first_name ? e.employee.first_name[0] : (e.employee_name ? e.employee_name[0] : <User size={14} />)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-[#1A1727] truncate leading-tight">
                            {e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : (e.employee_name || 'Unknown')}
                          </div>
                          <div className="text-[11px] font-bold text-[#9CA3AF] truncate leading-tight">{e.employee?.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <a 
                        href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-[#F1F0F4] text-[#534AB7] hover:bg-[#534AB7] hover:text-white transition-all"
                      >
                        <MapPin size={16} />
                      </a>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-block w-10 h-10 rounded-lg bg-[#F1F0F4] overflow-hidden border-2 border-white shadow-sm hover:scale-110 transition-all cursor-zoom-in">
                        <img src={e.selfie_url} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {e.suspicious_flags?.slice(0, 2).map(f => (
                          <span key={f} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${FLAG_COLORS[f]?.bg || 'bg-gray-50'} ${FLAG_COLORS[f]?.text || 'text-gray-700'}`}>
                            {FLAG_LABELS[f] || f}
                          </span>
                        ))}
                        {e.suspicious_flags && e.suspicious_flags.length > 2 && (
                          <span className="px-2 py-0.5 rounded bg-white border border-[#F1F0F4] text-[#9CA3AF] text-[8px] font-black uppercase tracking-widest">
                            +{e.suspicious_flags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-[#534AB7] text-[12px]">
                      {e.ip_check_status === 'done' ? `${Math.round(e.ip_distance_km || 0)}km` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] ${
                        e.admin_review_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        e.admin_review_status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {e.admin_review_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {e.admin_review_status === 'flagged' && (
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all">
                           <button 
                             onClick={(evt) => { evt.stopPropagation(); setSelected(e); handleReview('approved') }}
                             disabled={processingId === e.id}
                             className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                           >
                             <CheckCircle size={16} />
                           </button>
                           <button 
                             onClick={(evt) => { evt.stopPropagation(); setSelected(e); handleReview('rejected') }}
                             disabled={processingId === e.id}
                             className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                           >
                             <XCircle size={16} />
                           </button>
                        </div>
                      )}
                      <ChevronRight size={18} className="text-[#D1D5DB]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right Detail Panel */}
          {selected && (
            <div className="w-[450px] bg-white overflow-y-auto border-l border-[#F1F0F4] animate-in slide-in-from-right duration-300 shadow-2xl z-20">
              <div className="p-6 border-b border-[#F1F0F4] sticky top-0 bg-white z-10 flex items-center justify-between">
                <h2 className="text-[16px] font-black text-[#1A1727] uppercase tracking-tight">Punch Details</h2>
                <button onClick={() => setSelected(null)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all">
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Selfie Header */}
                <div className="relative group">
                  <div className="aspect-[4/3] rounded-[24px] overflow-hidden bg-[#F8F7F9] border border-[#F1F0F4] shadow-sm">
                    <img src={selected.selfie_url} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute top-4 left-4">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] shadow-lg ${
                      selected.admin_review_status === 'approved' ? 'bg-emerald-500 text-white' :
                      selected.admin_review_status === 'rejected' ? 'bg-red-500 text-white' :
                      'bg-amber-400 text-white'
                    }`}>
                      {selected.admin_review_status}
                    </span>
                  </div>
                </div>

                {/* Flags Section */}
                <div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3 px-1">Detected Signals</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.suspicious_flags?.map(f => (
                      <div key={f} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${FLAG_COLORS[f]?.bg || 'bg-gray-50'} ${FLAG_COLORS[f]?.text || 'text-gray-700'} border-black/5 shadow-sm`}>
                        <ShieldAlert size={14} />
                        <span className="text-[11px] font-extrabold uppercase tracking-tight">{FLAG_LABELS[f] || f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location Card */}
                <div className="bg-[#F8F7F9] rounded-[24px] p-6 border border-[#F1F0F4] space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#F1F0F4]/50">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#534AB7] shadow-sm">
                      <Navigation size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Geolocation</div>
                      <div className="text-[13px] font-extrabold text-[#1A1727]">{selected.work_type ? selected.work_type.toUpperCase() : 'OFFICE'} WORK</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 text-[13px]">
                    <div>
                      <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-0.5">Claimed GPS</p>
                      <p className="font-mono font-bold text-[#1A1727] text-[11px] truncate">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p>
                      <a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" className="text-[10px] text-[#534AB7] font-black uppercase tracking-widest flex items-center gap-1 mt-1">
                        Map <ExternalLink size={10} />
                      </a>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-0.5">GPS Accuracy</p>
                      <p className="font-bold text-[#1A1727]">±{Math.round(selected.gps_accuracy)}m</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-0.5">Real IP Location</p>
                      <p className="font-bold text-[#1A1727]">{selected.ip_city || 'Unknown'}, {selected.ip_country || '??'}</p>
                      <p className="text-[11px] font-mono text-[#9CA3AF]">{selected.client_ip}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-0.5">IP↔GPS Gap</p>
                      <p className={`font-black ${selected.ip_distance_km && selected.ip_distance_km > 50 ? 'text-red-600' : 'text-[#534AB7]'}`}>
                        {selected.ip_check_status === 'done' ? `${Math.round(selected.ip_distance_km || 0)} km` : 'Pending...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Device Info */}
                <div className="bg-[#F8F7F9] rounded-[24px] p-6 border border-[#F1F0F4] space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#F1F0F4]/50">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#534AB7] shadow-sm">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Device Fingerprint</div>
                      <div className="text-[13px] font-extrabold text-[#1A1727] truncate w-[280px]">{selected.device_info ? selected.device_info.split(')')[0] + ')' : 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                     <div>
                       <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-0.5">Timezone</p>
                       <p className="font-bold text-[#1A1727]">UTC{selected.timezone_offset >= 0 ? '+' : ''}{selected.timezone_offset / 60}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-0.5">Language</p>
                       <p className="font-bold text-[#1A1727]">{selected.device_fingerprint?.language || 'en-US'}</p>
                     </div>
                  </div>
                </div>

                {/* Recent History */}
                <div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3 px-1">Recent History (Employee)</div>
                  <div className="space-y-2">
                    {recentPunches.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#F1F0F4] shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.admin_review_status === 'flagged' ? 'bg-red-50 text-red-600' : 'bg-[#F8F7F9] text-[#9CA3AF]'}`}>
                             {p.admin_review_status === 'flagged' ? <ShieldAlert size={16} /> : <Clock size={16} />}
                           </div>
                           <div>
                             <p className="text-[11px] font-black text-[#1A1727]">{new Date(p.timestamp).toLocaleString()}</p>
                             <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest">{p.work_type}</p>
                           </div>
                        </div>
                        {p.admin_review_status && (
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            p.admin_review_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            p.admin_review_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {p.admin_review_status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="pt-8 border-t border-[#F1F0F4] space-y-6 sticky bottom-0 bg-white pb-6 mt-auto">
                   {selected.admin_review_status === 'flagged' ? (
                     <>
                        <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 px-1">Review Decision</div>
                        <textarea
                          placeholder="Enter internal notes for this review..."
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          className="w-full p-4 bg-[#F8F7F9] border-none rounded-[24px] text-sm font-bold placeholder:text-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#534AB7]/10 h-24 resize-none shadow-inner"
                        />
                        <div className="flex gap-4">
                          <button
                            disabled={!!processingId}
                            onClick={() => handleReview('rejected')}
                            className="flex-1 py-4 bg-white border-2 border-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          >
                            Reject
                          </button>
                          <button
                            disabled={!!processingId}
                            onClick={() => handleReview('approved')}
                            className="flex-1 py-4 bg-[#534AB7] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
                          >
                            Approve
                          </button>
                        </div>
                     </>
                   ) : (selected.admin_review_status === 'approved' || selected.admin_review_status === 'rejected') ? (
                     <div className="bg-[#F8F7F9] rounded-2xl p-6 border border-[#F1F0F4] text-center">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white mx-auto mb-3 shadow-sm">
                           <CheckCircle size={24} className={selected.admin_review_status === 'approved' ? 'text-emerald-500' : 'text-red-500'} />
                        </div>
                        <p className="text-[14px] font-black text-[#1A1727] uppercase tracking-tight">Review Complete</p>
                        <p className="text-[11px] font-bold text-[#9CA3AF] mt-1">This punch has been {selected.admin_review_status}.</p>
                        {selected.admin_notes && (
                          <div className="mt-4 p-3 bg-white/50 rounded-xl text-[11px] text-[#6B6578] italic">"{selected.admin_notes}"</div>
                        )}
                     </div>
                   ) : null}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
