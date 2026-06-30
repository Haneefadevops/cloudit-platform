'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown, X } from 'lucide-react'
import { toast } from 'sonner'

interface SalaryComponent {
  id: string
  name: string
  type: 'earning' | 'deduction'
  calculation_type: 'fixed' | 'percentage' | 'formula'
  default_amount: number | null
  is_statutory: boolean
  is_taxable: boolean
  description: string | null
}

export default function SalaryComponentsPage() {
  const { organizationId, isLoaded } = useAuth()
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingComponent, setEditingComponent] = useState<SalaryComponent | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'earning' as 'earning' | 'deduction',
    calculation_type: 'fixed' as 'fixed' | 'percentage' | 'formula',
    default_amount: '',
    is_taxable: true,
    description: ''
  })

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadComponents()
    }
  }, [isLoaded, organizationId])

  const loadComponents = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('salary_components')
        .select('*')
        .eq('organization_id', organizationId)
        .order('type', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      setComponents(data || [])
    } catch (error) {
      toast.error('Failed to load salary components')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return
    try {
      const componentData = {
        organization_id: organizationId,
        name: formData.name,
        type: formData.type,
        calculation_type: formData.calculation_type,
        default_amount: formData.default_amount ? parseFloat(formData.default_amount) : null,
        is_statutory: false,
        is_taxable: formData.is_taxable,
        description: formData.description || null
      }
      if (editingComponent) {
        const { error } = await supabase.from('salary_components').update(componentData).eq('id', editingComponent.id)
        if (error) throw error
        toast.success('Component updated successfully')
      } else {
        const { error } = await supabase.from('salary_components').insert(componentData)
        if (error) throw error
        toast.success('Component created successfully')
      }
      setShowDialog(false)
      setEditingComponent(null)
      resetForm()
      await loadComponents()
    } catch (error) {
      toast.error('Failed to save component')
    }
  }

  const handleEdit = (component: SalaryComponent) => {
    setEditingComponent(component)
    setFormData({
      name: component.name,
      type: component.type,
      calculation_type: component.calculation_type,
      default_amount: component.default_amount?.toString() || '',
      is_taxable: component.is_taxable,
      description: component.description || ''
    })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this component?')) return
    try {
      const { error } = await supabase.from('salary_components').delete().eq('id', id)
      if (error) throw error
      toast.success('Component deleted successfully')
      await loadComponents()
    } catch (error) {
      toast.error('Failed to delete component')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', type: 'earning', calculation_type: 'fixed', default_amount: '', is_taxable: true, description: '' })
  }

  const earnings = components.filter(c => c.type === 'earning')
  const deductions = components.filter(c => c.type === 'deduction')

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Salary Components</h1>
            <p className="text-[11px] text-[#9CA3AF]">Manage earnings and deductions for payroll</p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingComponent(null); setShowDialog(true) }}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
          >
            <Plus size={13} strokeWidth={3} />
            Add Component
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Loading Components...</div>
          ) : (
            <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-500">
              {/* Earnings */}
              <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F1F0F4] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <TrendingUp size={15} strokeWidth={2.5} className="text-emerald-600" />
                  </div>
                  <h2 className="text-[13px] font-black text-[#1A1727]">Earnings</h2>
                  <span className="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{earnings.length}</span>
                </div>
                <div className="p-4">
                  {earnings.length === 0 ? (
                    <div className="py-12 text-center text-[#9CA3AF] font-bold text-[12px]">No earning components added</div>
                  ) : (
                    <div className="space-y-3">
                      {earnings.map((component) => (
                        <div key={component.id} className="p-4 border border-[#F1F0F4] rounded-xl hover:border-[#A78BFA] transition-all group">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-[13px] font-black text-[#1A1727]">{component.name}</h3>
                                {component.is_statutory && (
                                  <span className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-black uppercase tracking-widest">Statutory</span>
                                )}
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${component.is_taxable ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-50 text-[#9CA3AF] border-[#F1F0F4]'}`}>
                                  {component.is_taxable ? 'Taxable' : 'Non-taxable'}
                                </span>
                              </div>
                              {component.description && (
                                <p className="text-[11px] text-[#9CA3AF] mt-1">{component.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#6B7280] font-bold">
                                <span className="capitalize">{component.calculation_type}</span>
                                {component.default_amount && (
                                  <span className="text-emerald-600">
                                    {component.calculation_type === 'percentage' ? `${component.default_amount}%` : `LKR ${component.default_amount.toLocaleString()}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            {!component.is_statutory && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(component)} className="p-1.5 bg-[#F8F7F9] hover:bg-[#F3E8FF] text-[#9CA3AF] hover:text-[#534AB7] rounded-lg transition-all">
                                  <Edit size={13} />
                                </button>
                                <button onClick={() => handleDelete(component.id)} className="p-1.5 bg-red-50 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F1F0F4] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <TrendingDown size={15} strokeWidth={2.5} className="text-red-500" />
                  </div>
                  <h2 className="text-[13px] font-black text-[#1A1727]">Deductions</h2>
                  <span className="ml-auto text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{deductions.length}</span>
                </div>
                <div className="p-4">
                  {deductions.length === 0 ? (
                    <div className="py-12 text-center text-[#9CA3AF] font-bold text-[12px]">No deduction components added</div>
                  ) : (
                    <div className="space-y-3">
                      {deductions.map((component) => (
                        <div key={component.id} className="p-4 border border-[#F1F0F4] rounded-xl hover:border-[#A78BFA] transition-all group">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-[13px] font-black text-[#1A1727]">{component.name}</h3>
                                {component.is_statutory && (
                                  <span className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-black uppercase tracking-widest">Statutory</span>
                                )}
                              </div>
                              {component.description && (
                                <p className="text-[11px] text-[#9CA3AF] mt-1">{component.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#6B7280] font-bold">
                                <span className="capitalize">{component.calculation_type}</span>
                                {component.default_amount && (
                                  <span className="text-red-500">
                                    {component.calculation_type === 'percentage' ? `${component.default_amount}%` : `LKR ${component.default_amount.toLocaleString()}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            {!component.is_statutory && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(component)} className="p-1.5 bg-[#F8F7F9] hover:bg-[#F3E8FF] text-[#9CA3AF] hover:text-[#534AB7] rounded-lg transition-all">
                                  <Edit size={13} />
                                </button>
                                <button onClick={() => handleDelete(component.id)} className="p-1.5 bg-red-50 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Dialog */}
        {showDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingComponent ? 'Edit' : 'New'} Component</h2>
                <button onClick={() => { setShowDialog(false); setEditingComponent(null); resetForm() }} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Component Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="e.g. Transport Allowance"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'earning' | 'deduction' })}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                    >
                      <option value="earning">Earning</option>
                      <option value="deduction">Deduction</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Calculation</label>
                    <select
                      value={formData.calculation_type}
                      onChange={(e) => setFormData({ ...formData, calculation_type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                      <option value="formula">Formula</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
                    Default Amount {formData.calculation_type === 'percentage' && '(%)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.default_amount}
                    onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all resize-none"
                    rows={2}
                    placeholder="Optional description..."
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="is_taxable"
                    checked={formData.is_taxable}
                    onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                    className="w-4 h-4 text-[#534AB7] rounded focus:ring-[#534AB7]"
                  />
                  <span className="text-[11px] font-black text-[#374151] uppercase tracking-widest">Taxable Component</span>
                </label>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => { setShowDialog(false); setEditingComponent(null); resetForm() }} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">{editingComponent ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
