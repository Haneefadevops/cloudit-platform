'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { 
  Monitor, 
  Plus, 
  Edit2, 
  Trash2, 
  UserPlus, 
  Undo2, 
  Box,
  X,
  MapPin,
  Package,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckCircle,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'

interface AssetCategory {
  id: string
  name: string
}

interface Asset {
  id: string
  category_id: string | null
  name: string
  serial_number: string
  model_number: string | null
  purchase_date: string | null
  purchase_cost: number | null
  condition: 'good' | 'fair' | 'damaged' | 'new'
  status: 'available' | 'assigned' | 'maintenance' | 'retired'
  category?: {
    name: string
  }
}

interface Assignment {
  id: string
  asset_id: string
  employee_id: string
  assigned_at: string
  returned_at: string | null
  expected_return_at: string | null
  status: 'active' | 'returned'
  condition_on_assignment: string | null
  condition_on_return: string | null
  notes: string | null
  asset?: {
    name: string
    serial_number: string
  }
  employee?: {
    first_name: string
    last_name: string
  }
}

export default function AssetsAdminPage() {
  const { isLoaded } = useAuth()
  const [activeTab, setActiveTab] = useState<'registry' | 'assignments' | 'categories'>('registry')
  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Asset Dialog State
  const [showAssetDialog, setShowAssetDialog] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [assetForm, setAssetForm] = useState({
    name: '',
    category_id: '',
    serial_number: '',
    model_number: '',
    purchase_date: '',
    purchase_cost: '',
    condition: 'good' as Asset['condition'],
    status: 'available' as Asset['status']
  })
  
  // Category Dialog State
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  
  // Assignment Dialog State
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  // Return Dialog State
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returningAssignment, setReturningAssignment] = useState<Assignment | null>(null)
  const [returnForm, setReturnForm] = useState({
    return_date: new Date().toISOString().split('T')[0],
    condition: 'good' as 'good' | 'fair' | 'damaged',
    notes: ''
  })

  useEffect(() => {
    if (isLoaded) {
      loadData()
    }
  }, [isLoaded])

  async function loadData() {
    setLoading(true)
    try {
      const [catRes, assetRes, assignRes, empRes] = await Promise.all([
        api.get<AssetCategory[]>('/asset-categories'),
        api.get<Asset[]>('/assets'),
        api.get<Assignment[]>('/asset-assignments'),
        api.get<any[]>('/employees?status=active&limit=500'),
      ])
      setCategories(catRes.data || [])
      setAssets((assetRes.data || []).map(a => ({ ...a, category: { name: (a as any).category_name || 'Misc' } })))
      setAssignments(assignRes.data || [])
      setEmployees(empRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        name: assetForm.name,
        category_id: assetForm.category_id || null,
        serial_number: assetForm.serial_number,
        model_number: assetForm.model_number || null,
        purchase_date: assetForm.purchase_date || null,
        purchase_cost: assetForm.purchase_cost ? parseFloat(assetForm.purchase_cost) : null,
        condition: assetForm.condition,
        status: assetForm.status,
      }
      const res = editingAsset
        ? await api.patch<Asset>(`/assets/${editingAsset.id}`, payload)
        : await api.post<Asset>('/assets', payload)
      if (!res.ok) throw new Error(res.error || 'Failed to save asset')
      toast.success(editingAsset ? 'Asset updated' : 'Asset created')
      setShowAssetDialog(false)
      await loadData()
      if (!editingAsset) setActiveTab('registry')
    } catch (error: any) {
      console.error('Failed to save asset:', error)
      toast.error('Failed to save asset: ' + (error?.message || 'Unknown error'))
    }
  }

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Are you sure? This will also remove assignment history.')) return
    try {
      const res = await api.del<{ id: string }>(`/assets/${id}`)
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Asset deleted')
      loadData()
    } catch (error: any) {
      toast.error('Failed to delete asset: ' + (error?.message || 'Unknown error'))
    }
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post<AssetCategory>('/asset-categories', { name: categoryName })
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Category created')
      setShowCategoryDialog(false)
      setCategoryName('')
      loadData()
    } catch (error: any) {
      toast.error('Failed to create category: ' + (error?.message || 'Unknown error'))
    }
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset) return
    try {
      const res = await api.post<Assignment>('/asset-assignments', {
        asset_id: selectedAsset.id,
        employee_id: selectedEmployeeId,
      })
      if (!res.ok) throw new Error(res.error || 'Failed to assign asset')
      setShowAssignDialog(false)
      loadData()
      toast.success('Asset assigned')
    } catch (error: any) {
      toast.error('Failed to assign asset: ' + (error?.message || 'Unknown error'))
    }
  }

  const openReturnDialog = (assign: Assignment) => {
    setReturningAssignment(assign)
    setReturnForm({ return_date: new Date().toISOString().split('T')[0], condition: 'good', notes: '' })
    setShowReturnDialog(true)
  }

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returningAssignment) return
    try {
      // NOTE: backend return endpoint is not available yet; keep Supabase fallback for return
      const { error: assignError } = await supabase.from('asset_assignments').update({
        status: 'returned',
        returned_at: new Date(returnForm.return_date).toISOString(),
        condition_on_return: returnForm.condition,
        notes: returnForm.notes || null
      }).eq('id', returningAssignment.id)
      if (assignError) throw assignError

      const newAssetStatus = returnForm.condition === 'damaged' ? 'maintenance' : 'available'
      const { error: assetError } = await supabase.from('assets').update({
        status: newAssetStatus,
        condition: returnForm.condition
      }).eq('id', returningAssignment.asset_id)
      if (assetError) throw assetError

      setShowReturnDialog(false)
      await loadData()
      toast.success(returnForm.condition === 'damaged' ? 'Asset returned — marked for maintenance' : 'Asset returned successfully')
    } catch (error: any) {
      toast.error('Failed to return asset: ' + (error?.message || 'Unknown error'))
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Asset Registry</h1>
            <p className="text-[11px] text-[#9CA3AF]">Manage company property and employee assignments</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
            {activeTab === 'categories' ? (
              <button 
                onClick={() => setShowCategoryDialog(true)} 
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
              >
                <Plus size={13} strokeWidth={3} /> Add Category
              </button>
            ) : (
              <button 
                onClick={() => { setEditingAsset(null); setAssetForm({ name: '', category_id: '', serial_number: '', model_number: '', purchase_date: '', purchase_cost: '', condition: 'good', status: 'available' }); setShowAssetDialog(true); }} 
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
              >
                <Plus size={13} strokeWidth={3} /> Add Asset
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 flex items-center gap-8 shrink-0">
          {(['registry', 'assignments', 'categories'] as const).map(tab => (
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
          {activeTab === 'registry' && (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden animate-in fade-in duration-500">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                    <th className="px-6 py-4">Asset Detail</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Serial/Model</th>
                    <th className="px-6 py-4 text-right px-8">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F0F4]">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Syncing Registry...</td></tr>
                  ) : assets.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center flex flex-col items-center text-[#9CA3AF]">
                      <Package size={40} className="mb-4 opacity-20" />
                      <div className="text-[13px] font-bold">No assets registered yet</div>
                    </td></tr>
                  ) : (
                    assets.map(asset => (
                      <tr key={asset.id} className="hover:bg-[#F8F7F9] transition-all group">
                        <td className="px-6 py-4">
                          <div className="text-[14px] font-black text-[#1A1727] group-hover:text-[#534AB7] transition-colors">{asset.name}</div>
                          <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter mt-0.5">{asset.condition} condition</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-[12px] font-bold text-[#374151]">{asset.category?.name || 'Misc'}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 w-fit mx-auto ${
                            asset.status === 'available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            asset.status === 'assigned' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                            'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            <div className="w-1 h-1 rounded-full bg-current" />
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="text-[11px] font-bold text-[#374151] font-mono tracking-tighter">{asset.serial_number}</div>
                           <div className="text-[9px] text-[#D1D5DB] font-bold uppercase">{asset.model_number || '—'}</div>
                        </td>
                        <td className="px-6 py-4 text-right px-8">
                          <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            {asset.status === 'available' && (
                              <button onClick={() => { setSelectedAsset(asset); setShowAssignDialog(true); }} className="p-1.5 hover:bg-[#F3E8FF] text-[#D1D5DB] hover:text-[#534AB7] rounded-lg transition-all" title="Assign to Employee"><UserPlus size={15} strokeWidth={2.5} /></button>
                            )}
                            <button onClick={() => { setEditingAsset(asset); setAssetForm({ name: asset.name, category_id: asset.category_id || '', serial_number: asset.serial_number, model_number: asset.model_number || '', purchase_date: asset.purchase_date || '', purchase_cost: asset.purchase_cost?.toString() || '', condition: asset.condition, status: asset.status }); setShowAssetDialog(true); }} className="p-1.5 hover:bg-blue-50 text-[#D1D5DB] hover:text-blue-600 rounded-lg transition-all"><Edit2 size={15} strokeWidth={2.5} /></button>
                            <button onClick={() => handleDeleteAsset(asset.id)} className="p-1.5 hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 rounded-lg transition-all"><Trash2 size={15} strokeWidth={2.5} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden animate-in fade-in duration-500">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4 text-center">Dates</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right px-8">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F0F4]">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Loading History...</td></tr>
                  ) : assignments.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-[#9CA3AF] italic text-xs">No assignment records found.</td></tr>
                  ) : (
                    assignments.map(as => (
                      <tr key={as.id} className="hover:bg-[#F8F7F9] transition-all group">
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-black text-[#1A1727]">{as.employee?.first_name} {as.employee?.last_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-bold text-[#374151]">{as.asset?.name}</div>
                          <div className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-tighter">{as.asset?.serial_number}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-[11px] font-bold text-[#374151]">{new Date(as.assigned_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ➔ {as.returned_at ? new Date(as.returned_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Now'}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 w-fit mx-auto ${
                            as.status === 'active' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            <div className="w-1 h-1 rounded-full bg-current" />
                            {as.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right px-8">
                          {as.status === 'active' && (
                            <button onClick={() => openReturnDialog(as)} className="px-3 py-1.5 bg-white border border-[#F1F0F4] text-[#534AB7] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#F3E8FF] transition-all shadow-sm">
                              <Undo2 size={12} strokeWidth={3} className="inline mr-1" /> Return
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
              {loading ? (
                <div className="col-span-full py-20 text-center font-bold text-[#D1D5DB] animate-pulse">Syncing Categories...</div>
              ) : categories.length === 0 ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center text-[#9CA3AF]">
                  <Box size={40} className="mb-4 opacity-20" />
                  <div className="text-[13px] font-bold">No categories defined</div>
                </div>
              ) : (
                categories.map(cat => (
                  <div key={cat.id} className="bg-white rounded-2xl p-6 border border-[#F1F0F4] shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#534AB7] shadow-sm">
                        <Box size={20} />
                      </div>
                      <span className="text-[14px] font-black text-[#1A1727]">{cat.name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dialogs Implementation */}
        {showAssetDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingAsset ? 'Edit' : 'Register'} Asset</h2>
                <button onClick={() => setShowAssetDialog(false)} className="p-2 hover:bg-[#F8F7F9] rounded-xl text-[#9CA3AF] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSaveAsset} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Asset Name</label>
                  <input required value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all" placeholder="e.g. MacBook Pro 14" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Category</label>
                    <select value={assetForm.category_id} onChange={e => setAssetForm({...assetForm, category_id: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none bg-white">
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Current Status</label>
                    <select value={assetForm.status} onChange={e => setAssetForm({...assetForm, status: e.target.value as any})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none bg-white">
                      <option value="available">Available</option>
                      <option value="assigned">Assigned</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Serial Number</label>
                    <input required value={assetForm.serial_number} onChange={e => setAssetForm({...assetForm, serial_number: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] font-mono" placeholder="SN-12345" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Model Number</label>
                    <input value={assetForm.model_number || ''} onChange={e => setAssetForm({...assetForm, model_number: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] font-mono" placeholder="A2779" />
                  </div>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowAssetDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save Asset</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCategoryDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <h2 className="text-xl font-black text-[#1A1727] tracking-tight mb-8">New Category</h2>
              <form onSubmit={handleSaveCategory} className="space-y-6">
                <div>
                   <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Category Name</label>
                   <input required value={categoryName} onChange={e => setCategoryName(e.target.value)} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all" placeholder="e.g. Laptop, Mobile" />
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowCategoryDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showReturnDialog && returningAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Return Asset</h2>
                <button onClick={() => setShowReturnDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <div className="mb-6 p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                <p className="text-[14px] font-black text-[#1A1727]">{returningAssignment.asset?.name}</p>
                <p className="text-[11px] text-[#9CA3AF] font-mono uppercase mt-1">{returningAssignment.asset?.serial_number}</p>
              </div>
              <form onSubmit={handleConfirmReturn} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Return Date</label>
                  <input type="date" required value={returnForm.return_date} onChange={e => setReturnForm({...returnForm, return_date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3 ml-1">Condition on Return</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['good', 'fair', 'damaged'] as const).map(c => (
                      <button key={c} type="button" onClick={() => setReturnForm({...returnForm, condition: c})}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${returnForm.condition === c
                          ? c === 'good' ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                            : c === 'fair' ? 'bg-amber-50 border-amber-500 text-amber-700'
                            : 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-[#F8F7F9] border-[#F1F0F4] text-[#9CA3AF] hover:border-[#D1D5DB]'}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Notes</label>
                  <textarea value={returnForm.notes} onChange={e => setReturnForm({...returnForm, notes: e.target.value})} rows={2} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all resize-none" placeholder="Add return details..." />
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowReturnDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className={`flex-1 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg transition-all text-white ${returnForm.condition === 'damaged' ? 'bg-red-500 hover:bg-red-600 shadow-red-900/20' : 'bg-[#534AB7] hover:bg-[#1E1854] shadow-purple-900/20'}`}>Confirm Return</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAssignDialog && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-[#F1F0F4]">
              <h2 className="text-xl font-black text-[#1A1727] tracking-tight mb-8 text-center">Assign {selectedAsset.name}</h2>
              <form onSubmit={handleAssign} className="space-y-6">
                <div>
                   <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Choose Employee</label>
                   <select required value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all">
                      <option value="">Select individual...</option>
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                   </select>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowAssignDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20">Confirm</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
