'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { 
  TrendingUp, 
  Plus, 
  Target, 
  Users, 
  Star, 
  FileText, 
  CheckCircle,
  Clock,
  Filter,
  Search,
  X,
  ChevronRight,
  ClipboardCheck,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface ReviewCycle {
  id: string
  title: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
}

interface Review {
  id: string
  status: 'pending_self' | 'pending_manager' | 'under_review' | 'completed'
  self_rating: number | null
  manager_rating: number | null
  final_rating: number | null
  employee: {
    first_name: string
    last_name: string
    job_title: string
  }
}

interface Goal {
  id: string
  title: string
  kpi_metric: string
  target_value: number
  current_value: number
  status: 'active' | 'achieved' | 'at_risk' | 'missed'
  employee: {
    first_name: string
    last_name: string
  }
}

export default function PerformanceAdminPage() {
  const { isLoaded } = useAuth()
  const [activeTab, setActiveTab] = useState<'cycles' | 'reviews' | 'goals'>('cycles')
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // Cycle Dialog
  const [showCycleDialog, setShowCycleDialog] = useState(false)
  const [cycleForm, setCycleForm] = useState({ title: '', start_date: '', end_date: '', status: 'draft' })

  // Goal Dialog
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [goalForm, setGoalForm] = useState({ employee_id: '', title: '', kpi_metric: '', target_value: '', target_date: '', status: 'active' })
  const [employees, setEmployees] = useState<any[]>([])

  useEffect(() => {
    if (isLoaded) {
      loadData()
    }
  }, [isLoaded, activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'cycles') {
        const res = await api.get<ReviewCycle[]>('/performance/cycles')
        setCycles(res.data || [])
      } else if (activeTab === 'reviews') {
        const res = await api.get<Review[]>('/performance/reviews')
        setReviews(res.data || [])
      } else if (activeTab === 'goals') {
        const [goalRes, empRes] = await Promise.all([
          api.get<Goal[]>('/performance/goals'),
          api.get<any[]>('/employees?status=active&limit=500'),
        ])
        setGoals(goalRes.data || [])
        setEmployees(empRes.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post<ReviewCycle>('/performance/cycles', {
        title: cycleForm.title,
        start_date: cycleForm.start_date,
        end_date: cycleForm.end_date,
        status: cycleForm.status,
      })
      if (!res.ok) throw new Error(res.error || 'Failed to create cycle')
      setShowCycleDialog(false)
      loadData()
      toast.success('Review cycle created')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create cycle')
    }
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post<Goal>('/performance/goals', { 
        employee_id: goalForm.employee_id,
        title: goalForm.title,
        kpi_metric: goalForm.kpi_metric,
        target_value: parseFloat(goalForm.target_value),
        target_date: goalForm.target_date || null,
        status: goalForm.status,
      })
      if (!res.ok) throw new Error(res.error || 'Failed to assign goal')
      setShowGoalDialog(false)
      loadData()
      toast.success('Goal assigned')
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign goal')
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Performance & Goals</h1>
            <p className="text-[11px] text-[#9CA3AF]">Monitor employee KPIs and manage review cycles</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
            {activeTab === 'cycles' && (
              <button 
                onClick={() => setShowCycleDialog(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
              >
                <Plus size={13} strokeWidth={3} />
                New Cycle
              </button>
            )}
            {activeTab === 'goals' && (
              <button 
                onClick={() => setShowGoalDialog(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
              >
                <Target size={13} strokeWidth={3} />
                Assign Goal
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 flex items-center gap-8 shrink-0">
          {(['cycles', 'reviews', 'goals'] as const).map(tab => (
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
          {activeTab === 'cycles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
              {loading ? (
                <div className="col-span-full py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Syncing Cycles...</div>
              ) : cycles.length === 0 ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center text-[#9CA3AF]">
                  <ClipboardCheck size={40} className="mb-4 opacity-20" />
                  <div className="text-[13px] font-bold text-[#1A1727]">No performance cycles found</div>
                  <button onClick={() => setShowCycleDialog(true)} className="mt-4 text-[#534AB7] font-black text-[10px] uppercase tracking-widest">Create First Cycle →</button>
                </div>
              ) : (
                cycles.map(cycle => (
                  <div key={cycle.id} className="bg-white rounded-2xl p-6 border border-[#F1F0F4] shadow-sm hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#534AB7] shadow-sm">
                        <ClipboardCheck size={20} />
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${
                        cycle.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${cycle.status === 'active' ? 'bg-emerald-600' : 'bg-gray-500'}`} />
                        {cycle.status}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-black text-[#1A1727] mb-1">{cycle.title}</h3>
                    <p className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                      {new Date(cycle.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {new Date(cycle.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <div className="mt-6 pt-4 border-t border-[#F8F7F9] flex justify-between items-center">
                      <button className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest hover:text-[#1E1854] flex items-center gap-1">Manage Cycle <ChevronRight size={10} strokeWidth={3} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden animate-in fade-in duration-500">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Self Rating</th>
                    <th className="px-6 py-4 text-center">Manager Rating</th>
                    <th className="px-6 py-4 text-right px-8">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F0F4]">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Processing Reviews...</td></tr>
                  ) : reviews.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-[#9CA3AF] italic text-xs">No reviews found for this criteria.</td></tr>
                  ) : (
                    reviews.map(rev => (
                      <tr key={rev.id} className="hover:bg-[#F8F7F9] transition-all group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#F3E8FF] border-2 border-white flex items-center justify-center text-[#534AB7] font-black text-[10px]">
                              {rev.employee?.first_name[0]}
                            </div>
                            <div>
                              <div className="text-[13px] font-black text-[#1A1727]">{rev.employee?.first_name} {rev.employee?.last_name}</div>
                              <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">{rev.employee?.job_title}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 w-fit mx-auto ${
                            rev.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            <div className="w-1 h-1 rounded-full bg-current" />
                            {rev.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="text-[13px] font-black text-[#374151] font-mono">{rev.self_rating || '—'} <span className="text-[9px] text-[#D1D5DB]">/ 5</span></div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="text-[13px] font-black text-[#1A1727] font-mono">{rev.manager_rating || '—'} <span className="text-[9px] text-[#D1D5DB]">/ 5</span></div>
                        </td>
                        <td className="px-6 py-4 text-right px-8">
                          <button className="p-1.5 hover:bg-[#F3E8FF] text-[#D1D5DB] hover:text-[#534AB7] rounded-lg transition-all">
                            <FileText size={16} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
              {loading ? (
                <div className="col-span-full py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Tracking Progress...</div>
              ) : goals.length === 0 ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center text-[#9CA3AF]">
                   <Target size={40} className="mb-4 opacity-20" />
                   <div className="text-[13px] font-bold text-[#1A1727]">No active goals assigned</div>
                   <button onClick={() => setShowGoalDialog(true)} className="mt-4 text-[#534AB7] font-black text-[10px] uppercase tracking-widest">Assign First Goal →</button>
                </div>
              ) : (
                goals.map(goal => {
                  const progress = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0
                  return (
                    <div key={goal.id} className="bg-white rounded-2xl p-6 border border-[#F1F0F4] shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
                            <Target size={16} strokeWidth={3} />
                          </div>
                          <div>
                            <h3 className="text-[14px] font-black text-[#1A1727]">{goal.title}</h3>
                            <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mt-0.5">{goal.employee?.first_name} {goal.employee?.last_name}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                          goal.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>{goal.status}</span>
                      </div>
                      <div className="space-y-2 mt-6">
                        <div className="flex justify-between text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">
                          <span>Target: {goal.current_value} / {goal.target_value} {goal.kpi_metric}</span>
                          <span className="text-[#534AB7]">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-[#F8F7F9] rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-[#534AB7] h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(83,74,183,0.4)]" 
                            style={{ width: `${Math.min(progress, 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Dialogs with updated style */}
        {showCycleDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">New Review Cycle</h2>
                <button onClick={() => setShowCycleDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleCreateCycle} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Cycle Title</label>
                  <input required value={cycleForm.title} onChange={e => setCycleForm({...cycleForm, title: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all" placeholder="e.g. Annual Performance Review 2026" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Start Date</label>
                    <input type="date" required value={cycleForm.start_date} onChange={e => setCycleForm({...cycleForm, start_date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">End Date</label>
                    <input type="date" required value={cycleForm.end_date} onChange={e => setCycleForm({...cycleForm, end_date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowCycleDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Create Cycle</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showGoalDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Assign New Goal</h2>
                <button onClick={() => setShowGoalDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleCreateGoal} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Select Employee</label>
                  <select required value={goalForm.employee_id} onChange={e => setGoalForm({...goalForm, employee_id: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all">
                    <option value="">Choose employee...</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Goal Title</label>
                  <input required value={goalForm.title} onChange={e => setGoalForm({...goalForm, title: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" placeholder="e.g. Increase System Uptime to 99.9%" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">KPI Metric</label>
                    <input required value={goalForm.kpi_metric} onChange={e => setGoalForm({...goalForm, kpi_metric: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" placeholder="e.g. Percent, Total" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Target Value</label>
                    <input type="number" required value={goalForm.target_value} onChange={e => setGoalForm({...goalForm, target_value: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowGoalDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Assign Goal</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
