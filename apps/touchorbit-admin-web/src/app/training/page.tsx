'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import {
  GraduationCap,
  Plus,
  Edit2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  X,
  BookOpen,
  Calendar,
  XCircle,
  RefreshCw,
  ChevronRight,
  ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'
import { ToBadge } from '@/components/ui/ToBadge'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/ToSkeleton'
import { ToEmptyState } from '@/components/ui/ToEmptyState'

interface TrainingProgram {
  id: string
  title: string
  description: string | null
  category: string | null
  total_hours: number | null
  is_mandatory: boolean
}

interface TrainingAssignment {
  id: string
  status: 'assigned' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  score: number | null
  completed_at: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  reschedule_requested: boolean
  reschedule_reason: string | null
  reschedule_new_start_date: string | null
  reschedule_new_end_date: string | null
  cancel_requested: boolean
  cancel_reason: string | null
  employee: {
    first_name: string
    last_name: string
    department: string
  }
  program: {
    title: string
  }
}

const formatTime = (timeString: string | null) => {
  if (!timeString) return null
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

export default function TrainingAdminPage() {
  const { isLoaded } = useAuth()
  const [activeTab, setActiveTab] = useState<'programs' | 'assignments'>('programs')
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showProgramDialog, setShowProgramDialog] = useState(false)
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null)
  const [programForm, setProgramForm] = useState({ title: '', description: '', category: 'Technical', total_hours: '', is_mandatory: false })

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [assignmentDates, setAssignmentDates] = useState({ start: '', end: '', start_time: '', end_time: '' })

  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'reschedule' | 'cancel'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [showEditDatesModal, setShowEditDatesModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<TrainingAssignment | null>(null)
  const [editDatesForm, setEditDatesForm] = useState({ start: '', end: '', start_time: '', end_time: '' })

  useEffect(() => {
    if (isLoaded) {
      loadData()
    }
  }, [isLoaded])

  async function loadData() {
    setLoading(true)
    try {
      const [progRes, assignRes, empRes] = await Promise.all([
        api.get<TrainingProgram[]>('/training'),
        api.get<TrainingAssignment[]>('/training/assignments'),
        api.get<any[]>('/employees?status=active&limit=500'),
      ])
      setPrograms(progRes.data || [])
      setAssignments(assignRes.data || [])
      setEmployees(empRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        title: programForm.title,
        description: programForm.description || null,
        category: programForm.category,
        total_hours: programForm.total_hours ? parseFloat(programForm.total_hours) : null,
        is_mandatory: programForm.is_mandatory,
      }
      const res = editingProgram
        ? await api.patch<TrainingProgram>(`/training/programs/${editingProgram.id}`, data)
        : await api.post<TrainingProgram>('/training/programs', data)
      if (!res.ok) throw new Error(res.error || 'Save failed')
      setShowProgramDialog(false)
      loadData()
      toast.success('Program saved')
    } catch (error: any) {
      toast.error(error.message || 'Error saving program')
    }
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post<TrainingAssignment>('/training/assignments', {
        program_id: selectedProgramId,
        employee_id: selectedEmployeeId,
        start_date: assignmentDates.start,
        end_date: assignmentDates.end,
        start_time: assignmentDates.start_time || null,
        end_time: assignmentDates.end_time || null,
      })
      if (!res.ok) throw new Error(res.error || 'Failed to assign training')
      setShowAssignDialog(false)
      loadData()
      toast.success('Training assigned')
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign training')
    }
  }

  const handleApproveReschedule = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      const res = await api.post<TrainingAssignment>(`/training/assignments/${requestId}/reschedule-approve`, {})
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Reschedule approved')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve reschedule')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectReschedule = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      const res = await api.post<TrainingAssignment>(`/training/assignments/${requestId}/reschedule-reject`, {})
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Reschedule request rejected')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject reschedule')
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveCancel = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      const res = await api.post<TrainingAssignment>(`/training/assignments/${requestId}/cancel-approve`, {})
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Cancellation approved')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve cancellation')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectCancel = async (requestId: string) => {
    setProcessingId(requestId)
    try {
      const res = await api.post<TrainingAssignment>(`/training/assignments/${requestId}/cancel-reject`, {})
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Cancellation request rejected')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject cancellation')
    } finally {
      setProcessingId(null)
    }
  }

  const openEditDatesModal = (assignment: TrainingAssignment) => {
    setEditingAssignment(assignment)
    setEditDatesForm({
      start: assignment.start_date || '',
      end: assignment.end_date || '',
      start_time: assignment.start_time || '',
      end_time: assignment.end_time || ''
    })
    setShowEditDatesModal(true)
  }

  const handleEditDates = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAssignment) return

    try {
      const res = await api.patch<TrainingAssignment>(`/training/assignments/${editingAssignment.id}`, {
        start_date: editDatesForm.start,
        end_date: editDatesForm.end,
        start_time: editDatesForm.start_time || null,
        end_time: editDatesForm.end_time || null,
      })
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Training schedule updated')
      setShowEditDatesModal(false)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update dates')
    }
  }

  const handleCancelAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to cancel this training assignment?')) return

    try {
      const res = await api.patch<TrainingAssignment>(`/training/assignments/${assignmentId}`, { status: 'cancelled' })
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Training cancelled')
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel training')
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Advanced Training</h1>
            <p className="text-[11px] text-[#9CA3AF]">Manage educational programs and track employee certifications</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
            <button
              onClick={() => setShowAssignDialog(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-[#F1F0F4] text-[#6B7280] rounded-lg hover:bg-[#F8F7F9] transition-all text-xs font-bold shadow-sm"
            >
              <Users size={13} strokeWidth={2.5} />
              Assign Group
            </button>
            <button
              onClick={() => { setEditingProgram(null); setProgramForm({ title: '', description: '', category: 'Technical', total_hours: '', is_mandatory: false }); setShowProgramDialog(true); }}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
            >
              <Plus size={13} strokeWidth={3} />
              New Program
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 flex items-center gap-8 shrink-0">
          {(['programs', 'assignments'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 pt-4 px-1 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === tab ? 'text-[#534AB7]' : 'text-[#9CA3AF] hover:text-[#374151]'}`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#534AB7] rounded-full shadow-[0_0_8px_#534AB7]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'programs' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
              {loading ? (
                <>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </>
              ) : programs.length === 0 ? (
                <div className="col-span-full">
                  <ToEmptyState
                    icon={<BookOpen size={40} className="text-[#D1D5DB]" />}
                    title="No training programs found"
                    description="Create your first training program to start tracking employee development."
                    action={{ label: 'Create First Program →', onClick: () => setShowProgramDialog(true) }}
                  />
                </div>
              ) : (
                programs.map(prog => (
                  <div key={prog.id} className="bg-white rounded-2xl p-6 border border-[#F1F0F4] shadow-sm hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#534AB7] shadow-sm">
                        <BookOpen size={20} />
                      </div>
                      {prog.is_mandatory && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                          <ShieldAlert size={8} /> Mandatory
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-black text-[#1A1727] mb-1">{prog.title}</h3>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed line-clamp-2 h-8">{prog.description || 'No description provided.'}</p>
                    <div className="mt-6 pt-4 border-t border-[#F8F7F9] flex items-center justify-between">
                       <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{prog.category}</span>
                       <button
                         onClick={() => { setEditingProgram(prog); setProgramForm({ title: prog.title, description: prog.description || '', category: prog.category || 'Technical', total_hours: prog.total_hours?.toString() || '', is_mandatory: prog.is_mandatory }); setShowProgramDialog(true); }}
                         className="p-1.5 hover:bg-[#F3E8FF] text-[#D1D5DB] hover:text-[#534AB7] rounded-lg transition-all"
                       >
                         <Edit2 size={14} strokeWidth={2.5} />
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Assignment Filters */}
              <div className="flex items-center justify-between">
                <div className="flex bg-[#F1F0F4] p-1 rounded-xl w-fit">
                  {[
                    { id: 'all', label: 'All Assignments' },
                    { id: 'reschedule', label: 'Reschedule Req', alert: assignments.some(a => a.reschedule_requested) },
                    { id: 'cancel', label: 'Cancel Req', alert: assignments.some(a => a.cancel_requested) }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setAssignmentFilter(f.id as any)}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                        assignmentFilter === f.id ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'
                      }`}
                    >
                      {f.label}
                      {f.alert && <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Training Program</th>
                      <th className="px-6 py-4">Schedule</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right px-8">Audit Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F0F4]">
                    {loading ? (
                      <TableSkeleton rows={5} columns={5} />
                    ) : (() => {
                      const filtered = assignments.filter(as => {
                        if (assignmentFilter === 'reschedule') return as.reschedule_requested
                        if (assignmentFilter === 'cancel') return as.cancel_requested
                        return true
                      })

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="py-16">
                              <ToEmptyState
                                icon={<BookOpen size={40} className="text-[#D1D5DB]" />}
                                title="No assignments matching this filter"
                                description="Assign employees to training programs to see them here."
                              />
                            </td>
                          </tr>
                        )
                      }

                      return filtered.map(as => (
                        <tr key={as.id} className="hover:bg-[#F8F7F9] transition-all group">
                          <td className="px-6 py-4">
                            <div className="text-[13px] font-black text-[#1A1727]">{as.employee?.first_name} {as.employee?.last_name}</div>
                            <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">{as.employee?.department}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[13px] font-bold text-[#374151]">{as.program?.title}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[11px] font-bold text-[#1A1727]">
                              {as.start_date ? new Date(as.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'} - {as.end_date ? new Date(as.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                            {(as.start_time || as.end_time) && (
                              <div className="text-[9px] font-black text-[#534AB7] uppercase tracking-widest mt-1">
                                {formatTime(as.start_time) || '—'} ➔ {formatTime(as.end_time) || '—'}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center">
                              <ToBadge status={as.status} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right px-8">
                             {as.reschedule_requested || as.cancel_requested ? (
                               <div className="flex flex-col gap-2 items-end">
                                  {as.reschedule_requested && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left w-64 shadow-sm animate-in slide-in-from-right-4">
                                      <div className="text-[9px] font-black text-amber-600 uppercase mb-2">Reschedule Review</div>
                                      <div className="text-[10px] text-amber-800 font-bold mb-3">"{as.reschedule_reason}"</div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleApproveReschedule(as.id)} disabled={!!processingId} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm">Approve</button>
                                        <button onClick={() => handleRejectReschedule(as.id)} disabled={!!processingId} className="flex-1 py-1.5 bg-white border border-amber-200 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest">Reject</button>
                                      </div>
                                    </div>
                                  )}
                                  {as.cancel_requested && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-left w-64 shadow-sm animate-in slide-in-from-right-4">
                                      <div className="text-[9px] font-black text-red-600 uppercase mb-2 text-center border-b border-red-100 pb-2">Withdrawal Request</div>
                                      <div className="text-[10px] text-red-800 font-bold mb-3 italic">"{as.cancel_reason}"</div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleApproveCancel(as.id)} disabled={!!processingId} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm">Approve</button>
                                        <button onClick={() => handleRejectCancel(as.id)} disabled={!!processingId} className="flex-1 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[8px] font-black uppercase tracking-widest">Reject</button>
                                      </div>
                                    </div>
                                  )}
                               </div>
                             ) : as.status !== 'cancelled' ? (
                               <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditDatesModal(as)} className="p-1.5 hover:bg-[#F3E8FF] text-[#D1D5DB] hover:text-[#534AB7] rounded-lg transition-all" title="Edit Schedule"><Calendar size={14} strokeWidth={2.5} /></button>
                                  <button onClick={() => handleCancelAssignment(as.id)} className="p-1.5 hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 rounded-lg transition-all" title="Cancel Assignment"><XCircle size={14} strokeWidth={2.5} /></button>
                               </div>
                             ) : <div className="text-[#D1D5DB] font-black text-[9px] uppercase tracking-widest">—</div>}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Dialogs with updated style */}
        {showProgramDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingProgram ? 'Edit' : 'New'} Program</h2>
                <button onClick={() => setShowProgramDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSaveProgram} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Program Title</label>
                  <input required value={programForm.title} onChange={e => setProgramForm({...programForm, title: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all" placeholder="e.g. Cybersecurity Essentials" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Program Overview</label>
                  <textarea value={programForm.description || ''} onChange={e => setProgramForm({...programForm, description: e.target.value})} className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all resize-none" rows={3} placeholder="What will participants learn?" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Category</label>
                    <select value={programForm.category || 'Technical'} onChange={e => setProgramForm({...programForm, category: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none bg-white">
                      <option value="Technical">Technical</option>
                      <option value="Soft Skills">Soft Skills</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Safety">Safety</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Duration (Hrs)</label>
                    <input type="number" step="0.5" value={programForm.total_hours} onChange={e => setProgramForm({...programForm, total_hours: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${programForm.is_mandatory ? 'bg-[#534AB7] border-[#534AB7]' : 'bg-[#F8F7F9] border-[#F1F0F4]'}`}>
                     <input type="checkbox" className="hidden" checked={programForm.is_mandatory} onChange={e => setProgramForm({...programForm, is_mandatory: e.target.checked})} />
                     {programForm.is_mandatory && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest group-hover:text-[#534AB7]">Mark as Mandatory</span>
                </label>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowProgramDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save Program</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAssignDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Assign Training</h2>
                <button onClick={() => setShowAssignDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleAssign} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Choose Program</label>
                  <select required value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none">
                    <option value="">Select a program...</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Select Employee</label>
                  <select required value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none">
                    <option value="">Select individual...</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Start Date</label>
                    <input type="date" required value={assignmentDates.start} onChange={e => setAssignmentDates({...assignmentDates, start: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">End Date</label>
                    <input type="date" required value={assignmentDates.end} onChange={e => setAssignmentDates({...assignmentDates, end: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowAssignDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Assign Now</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
