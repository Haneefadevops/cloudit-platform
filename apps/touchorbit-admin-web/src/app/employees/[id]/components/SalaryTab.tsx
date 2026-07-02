'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, RefreshCcw, Plus, X, ArrowUpRight, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { MiniSparkline } from '@/components/widgets/_shared/MiniSparkline'

interface SalaryRevision {
  id?: string
  previous_salary: number
  new_salary: number
  effective_date: string
  reason?: string
}

interface SalaryComponent {
  id: string
  name: string
  type: 'earning' | 'deduction'
  calculation_type: 'fixed' | 'percentage' | 'formula'
  default_amount: number | null
}

interface StructureRow {
  id?: string
  component_id: string
  component_name?: string
  amount: number
  effective_from?: string
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  job_title: string | null
  basic_salary: number | null
  organization_id: string
}

interface SalaryTabProps {
  employee: Employee
  salaryHistory: SalaryRevision[]
  isLoading: boolean
  userEmail: string
  onUpdate: () => void
}

interface IncrementRow {
  type: string
  amountType: 'fixed' | 'percent'
  amount: string
}

export function SalaryTab({ employee, salaryHistory, isLoading, userEmail, onUpdate }: SalaryTabProps) {
  const [incrementRows, setIncrementRows] = useState<IncrementRow[]>([
    { type: 'Annual Increment', amountType: 'fixed', amount: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [structure, setStructure] = useState<StructureRow[]>([])
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [savingStructure, setSavingStructure] = useState(false)

  useEffect(() => {
    if (!employee.id) return
    let cancelled = false
    setLoadingStructure(true)
    Promise.all([
      api.get<SalaryComponent[]>('/payroll/salary-components'),
      api.get<StructureRow[]>(`/payroll/structures/${employee.id}`),
    ])
      .then(([componentsResult, structureResult]) => {
        if (cancelled) return
        if (componentsResult.ok) setComponents(componentsResult.data || [])
        if (structureResult.ok) setStructure(structureResult.data || [])
      })
      .catch((err) => console.error('Error loading salary structure:', err))
      .finally(() => {
        if (!cancelled) setLoadingStructure(false)
      })
    return () => { cancelled = true }
  }, [employee.id])

  const currentSalary = employee.basic_salary || 0
  const sparklineData = salaryHistory.length > 1
    ? salaryHistory.map((r) => r.new_salary)
    : []

  const totalIncrement = incrementRows.reduce((sum, row) => {
    const amt = parseFloat(row.amount) || 0
    return sum + (row.amountType === 'fixed' ? amt : (currentSalary * amt / 100))
  }, 0)
  const newSalary = Math.round(currentSalary + totalIncrement)

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || !userEmail) return
    setVerifying(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password.trim(),
      })
      if (error) {
        toast.error('Incorrect password. Please try again.')
        return
      }
      setIsRevealed(true)
      setShowPasswordForm(false)
      setPassword('')
      toast.success('Salary data unlocked')
    } catch {
      toast.error('Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleLock = () => {
    setIsRevealed(false)
    setPassword('')
    setShowPasswordForm(false)
  }

  const handleSaveRevision = async () => {
    if (!incrementRows.some((r) => parseFloat(r.amount) > 0)) return
    setSaving(true)
    try {
      const reason = incrementRows.map((r) => `${r.type}: ${r.amountType === 'fixed' ? 'LKR ' + r.amount : r.amount + '%'}`).join(', ')
      // TODO: migrate salary_revisions to backend once a salary/payroll domain API exists
      await supabase.from('salary_revisions').insert({
        employee_id: employee.id,
        organization_id: employee.organization_id,
        previous_salary: currentSalary,
        new_salary: newSalary,
        effective_date: new Date().toISOString().split('T')[0],
        reason,
      })
      const result = await api.patch<any>(`/employees/${employee.id}`, { basic_salary: newSalary })
      if (!result.ok) throw new Error(result.error || 'Failed to update salary')
      toast.success(`Salary updated to LKR ${newSalary.toLocaleString()}`)
      setIncrementRows([{ type: 'Annual Increment', amountType: 'fixed', amount: '' }])
      onUpdate()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save revision')
    } finally {
      setSaving(false)
    }
  }

  const addStructureRow = () => {
    setStructure([...structure, { component_id: '', amount: 0, effective_from: new Date().toISOString().split('T')[0] }])
  }

  const removeStructureRow = (index: number) => {
    setStructure(structure.filter((_, i) => i !== index))
  }

  const updateStructureRow = (index: number, patch: Partial<StructureRow>) => {
    const next = [...structure]
    next[index] = { ...next[index], ...patch }
    setStructure(next)
  }

  const handleSaveStructure = async () => {
    const payload = structure
      .filter((row) => row.component_id)
      .map((row) => ({
        component_id: row.component_id,
        amount: Number(row.amount) || 0,
        effective_from: row.effective_from || new Date().toISOString().split('T')[0],
      }))

    if (payload.length === 0 && structure.length > 0) {
      toast.error('Select a component for each row')
      return
    }

    setSavingStructure(true)
    try {
      const result = await api.post<StructureRow[]>(`/payroll/structures/${employee.id}`, payload)
      if (!result.ok) throw new Error(result.error || 'Failed to save salary structure')
      toast.success('Salary structure saved')
      const reload = await api.get<StructureRow[]>(`/payroll/structures/${employee.id}`)
      if (reload.ok) setStructure(reload.data || [])
    } catch (e: any) {
      toast.error(e.message || 'Failed to save salary structure')
    } finally {
      setSavingStructure(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="bg-[#1A1727] rounded-2xl p-6 h-32 animate-pulse" />
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 h-64 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Current Salary Card — password protected */}
      <div className="bg-[#1A1727] rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <DollarSign size={80} />
        </div>
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Current Monthly Salary</div>

        {isRevealed ? (
          <>
            <div className="text-3xl font-black tracking-tighter mb-1">LKR {currentSalary.toLocaleString()}</div>
            <div className="text-[11px] font-bold text-white/50">
              {employee.first_name} {employee.last_name} · {employee.job_title}
            </div>
            {sparklineData.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <MiniSparkline data={sparklineData} color="#10B981" width={100} height={28} />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Salary Trend</span>
              </div>
            )}
            <button
              onClick={handleLock}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
            >
              <Lock size={13} /> Lock Salary
            </button>
          </>
        ) : (
          <>
            <div className="text-3xl font-black tracking-tighter mb-1 text-white/30">LKR ••••••</div>
            <div className="text-[11px] font-bold text-white/30">
              {employee.first_name} {employee.last_name} · {employee.job_title}
            </div>

            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
              >
                <Unlock size={13} /> Reveal Salary
              </button>
            ) : (
              <form onSubmit={handleVerifyPassword} className="mt-4 flex items-center gap-2 max-w-sm animate-in zoom-in-95 duration-200">
                <div className="relative flex-1">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-bold text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={verifying || !password.trim()}
                  className="px-4 py-2.5 bg-white text-[#1A1727] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition-all disabled:opacity-50"
                >
                  {verifying ? '...' : 'Unlock'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPasswordForm(false); setPassword('') }}
                  className="p-2.5 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Increment Calculator */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <TrendingUp size={16} className="text-[#534AB7]" /> Salary Revision Calculator
          </h3>
          <button
            onClick={() => setIncrementRows([...incrementRows, { type: 'Annual Increment', amountType: 'fixed', amount: '' }])}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#F3E8FF] text-[#534AB7] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#DDD6FE] transition-colors"
          >
            <Plus size={12} /> Add Row
          </button>
        </div>

        <div className="space-y-3 mb-5">
          {incrementRows.map((row, i) => {
            const amt = parseFloat(row.amount) || 0
            const rowIncrement = row.amountType === 'fixed' ? amt : (currentSalary * amt / 100)
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center p-3 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                <select
                  value={row.type}
                  onChange={(e) => { const u = [...incrementRows]; u[i] = { ...u[i], type: e.target.value }; setIncrementRows(u) }}
                  className="px-2 py-1.5 bg-white border border-[#F1F0F4] rounded-lg text-[11px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                >
                  {['Annual Increment', 'Performance Review', 'Market Adjustment', 'Promotion', 'Cost of Living', 'Other'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <div className="flex rounded-lg overflow-hidden border border-[#F1F0F4] bg-white">
                  {(['fixed', 'percent'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => { const u = [...incrementRows]; u[i] = { ...u[i], amountType: type, amount: '' }; setIncrementRows(u) }}
                      className={`px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                        row.amountType === type ? 'bg-[#534AB7] text-white' : 'text-[#9994A8] hover:bg-[#F8F7F9]'
                      }`}
                    >
                      {type === 'fixed' ? 'LKR' : '%'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={row.amount}
                    onChange={(e) => { const u = [...incrementRows]; u[i] = { ...u[i], amount: e.target.value }; setIncrementRows(u) }}
                    placeholder={row.amountType === 'fixed' ? '0.00' : '0.0'}
                    className="w-full px-2 py-1.5 bg-white border border-[#F1F0F4] rounded-lg text-[11px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                  />
                  {row.amount && (
                    <div className="absolute -bottom-4 left-0 text-[9px] font-black text-emerald-600">+LKR {Math.round(rowIncrement).toLocaleString()}</div>
                  )}
                </div>
                {incrementRows.length > 1 && (
                  <button onClick={() => setIncrementRows(incrementRows.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Live summary */}
        <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4] mb-5 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">Current</div>
            <div className="text-base font-black text-[#1A1727]">
              {isRevealed ? `LKR ${currentSalary.toLocaleString()}` : 'LKR ••••••'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">Increment</div>
            <div className="text-base font-black text-emerald-600">+LKR {Math.round(totalIncrement).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">New Salary</div>
            <div className="text-base font-black text-[#534AB7]">
              {isRevealed ? `LKR ${newSalary.toLocaleString()}` : 'LKR ••••••'}
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveRevision}
          disabled={saving || !incrementRows.some((r) => parseFloat(r.amount) > 0)}
          className="px-6 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-[#1E1854] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Apply Salary Revision'}
        </button>
      </div>

      {/* Revision History Timeline */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest mb-5 flex items-center gap-2">
          <RefreshCcw size={16} className="text-[#534AB7]" /> Salary Revision History
        </h3>
        {salaryHistory.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-bold text-[#9CA3AF]">No salary revisions on record</div>
        ) : (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2 top-2 bottom-2 w-px bg-[#F1F0F4]" />
            <div className="space-y-4">
              {salaryHistory.map((rev, i) => {
                const delta = (rev.new_salary || 0) - (rev.previous_salary || 0)
                return (
                  <div key={i} className="relative flex items-start gap-4">
                    {/* Dot */}
                    <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                      delta > 0 ? 'bg-emerald-500' : delta < 0 ? 'bg-red-500' : 'bg-[#9994A8]'
                    }`}>
                      <ArrowUpRight size={10} className="text-white" />
                    </div>
                    <div className="flex-1 p-3 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-black text-[#1A1727]">
                          {isRevealed
                            ? `LKR ${(rev.previous_salary || 0).toLocaleString()} → LKR ${(rev.new_salary || 0).toLocaleString()}`
                            : 'LKR •••••• → LKR ••••••'}
                        </div>
                        <div className={`text-[11px] font-black ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {delta >= 0 ? '+' : ''}LKR {delta.toLocaleString()}
                        </div>
                      </div>
                      {rev.reason && <div className="text-[11px] text-[#6B6578] font-bold mt-0.5">{rev.reason}</div>}
                      <div className="text-[10px] text-[#9994A8] font-bold mt-1">
                        {rev.effective_date ? new Date(rev.effective_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Salary Structure */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <DollarSign size={16} className="text-[#534AB7]" /> Salary Structure
          </h3>
          <button
            onClick={addStructureRow}
            disabled={loadingStructure || components.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#F3E8FF] text-[#534AB7] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#DDD6FE] transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> Add Component
          </button>
        </div>

        {loadingStructure ? (
          <div className="py-8 text-center text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest animate-pulse">Loading Structure...</div>
        ) : components.length === 0 ? (
          <div className="py-8 text-center text-[13px] font-bold text-[#9CA3AF]">No salary components available. Create components in Payroll &rarr; Components first.</div>
        ) : (
          <>
            {structure.length === 0 ? (
              <div className="py-6 text-center text-[12px] font-bold text-[#9CA3AF]">No components assigned to this employee yet.</div>
            ) : (
              <div className="space-y-3 mb-5">
                {structure.map((row, i) => (
                  <div key={`${row.component_id}-${i}`} className="grid grid-cols-[1fr_auto_120px_auto] gap-3 items-center p-3 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                    <select
                      value={row.component_id}
                      onChange={(e) => updateStructureRow(i, { component_id: e.target.value })}
                      className="px-3 py-2 bg-white border border-[#F1F0F4] rounded-lg text-[11px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                    >
                      <option value="">Select component</option>
                      {components.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                      {components.find((c) => c.id === row.component_id)?.calculation_type === 'percentage' ? '%' : 'LKR'}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.amount}
                      onChange={(e) => updateStructureRow(i, { amount: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-2 bg-white border border-[#F1F0F4] rounded-lg text-[11px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                      placeholder="0.00"
                    />
                    <button
                      onClick={() => removeStructureRow(i)}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleSaveStructure}
              disabled={savingStructure || structure.length === 0}
              className="px-6 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-[#1E1854] transition-colors disabled:opacity-50"
            >
              {savingStructure ? 'Saving...' : 'Save Salary Structure'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
