'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Plus, Edit2, Trash2, Send, FileText, CheckCircle, Clock, XCircle, RefreshCw, X, ChevronRight, FileSignature } from 'lucide-react'
import { toast } from 'sonner'

interface DocumentTemplate {
  id: string
  name: string
  content: string
  description: string
  status: string
}

interface SentDocument {
  id: string
  title: string
  status: 'pending' | 'signed' | 'declined'
  signed_at: string | null
  created_at: string
  employee: {
    first_name: string
    last_name: string
  }
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_number: string
}

export default function DocumentsPage() {
  const { isLoaded } = useAuth()
  const [activeTab, setActiveTab] = useState<'templates' | 'sent'>('templates')
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [sentDocuments, setSentDocuments] = useState<SentDocument[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [showSendForm, setShowSendForm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)

  const [templateForm, setTemplateForm] = useState({ name: '', description: '', content: '' })
  const [sendForm, setSendForm] = useState({ employeeId: '', notes: '' })

  useEffect(() => {
    if (isLoaded) {
      loadData()
    }
  }, [isLoaded, activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'templates') {
        const res = await api.get<DocumentTemplate[]>('/document-templates')
        setTemplates(res.data || [])
      } else {
        const res = await api.get<SentDocument[]>('/documents')
        setSentDocuments(res.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployees() {
    const res = await api.get<Employee[]>('/employees?status=active&limit=500')
    setEmployees(res.data || [])
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!templateForm.name.trim() || !templateForm.content.trim()) { toast.error('Required fields missing'); return }

    try {
      const payload = { name: templateForm.name, description: templateForm.description, content: templateForm.content }
      if (editingTemplate) {
        // Backend currently has no template update endpoint
        toast.error('Template editing is not supported by the backend yet')
        return
      }
      const res = await api.post<DocumentTemplate>('/document-templates', payload)
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Template created')
      setShowTemplateForm(false)
      setEditingTemplate(null)
      setTemplateForm({ name: '', description: '', content: '' })
      loadData()
    } catch (error: any) {
      toast.error('Failed to save template: ' + (error?.message || 'Unknown error'))
    }
  }

  async function handleSendDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTemplate || !sendForm.employeeId) { toast.error('Select an employee'); return }
    try {
      const res = await api.post<SentDocument>('/documents', {
        template_id: selectedTemplate.id,
        employee_id: sendForm.employeeId,
        title: selectedTemplate.name,
        content: selectedTemplate.content,
        notes: sendForm.notes,
      })
      if (!res.ok) throw new Error(res.error || 'Failed')
      toast.success('Document sent!')
      setShowSendForm(false)
      setSelectedTemplate(null)
      setSendForm({ employeeId: '', notes: '' })
      setActiveTab('sent')
    } catch (error: any) {
      toast.error('Failed to send: ' + (error?.message || 'Unknown error'))
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    try {
      // Backend has no template delete endpoint yet; keep Supabase fallback
      const { error } = await supabase.from('document_templates').delete().eq('id', id)
      if (error) throw error
      toast.success('Template deleted')
      loadData()
    } catch (error: any) {
      toast.error('Failed to delete template: ' + (error?.message || 'Unknown error'))
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Document Signing</h1>
            <p className="text-[11px] text-[#9CA3AF]">Manage legal templates and track employee signatures</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={loadData} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
             {activeTab === 'templates' && (
              <button 
                onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', description: '', content: '' }); setShowTemplateForm(true); }}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
              >
                <Plus size={13} strokeWidth={3} />
                New Template
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 flex items-center gap-8 shrink-0">
          {(['templates', 'sent'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 pt-4 px-1 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === tab ? 'text-[#534AB7]' : 'text-[#9CA3AF] hover:text-[#374151]'}`}
            >
              {tab.replace('_', ' ')}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#534AB7] rounded-full shadow-[0_0_8px_#534AB7]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'templates' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
              {loading ? (
                <div className="col-span-full py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Syncing Templates...</div>
              ) : templates.length === 0 ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center text-[#9CA3AF]">
                  <FileSignature size={40} className="mb-4 opacity-20" />
                  <div className="text-[13px] font-bold text-[#1A1727]">No document templates found</div>
                  <button onClick={() => setShowTemplateForm(true)} className="mt-4 text-[#534AB7] font-black text-[10px] uppercase tracking-widest">Create First Template →</button>
                </div>
              ) : (
                templates.map(tmp => (
                  <div key={tmp.id} className="bg-white rounded-2xl p-6 border border-[#F1F0F4] shadow-sm hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#534AB7] shadow-sm">
                        <FileText size={20} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditingTemplate(tmp); setTemplateForm({ name: tmp.name, description: tmp.description || '', content: tmp.content }); setShowTemplateForm(true); }} className="p-1.5 hover:bg-[#F3E8FF] text-[#D1D5DB] hover:text-[#534AB7] rounded-lg transition-all"><Edit2 size={14} /></button>
                         <button onClick={() => handleDeleteTemplate(tmp.id)} className="p-1.5 hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 rounded-lg transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <h3 className="text-[15px] font-black text-[#1A1727] mb-1">{tmp.name}</h3>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed line-clamp-2 h-8">{tmp.description || 'No description provided.'}</p>
                    <div className="mt-6 pt-4 border-t border-[#F8F7F9]">
                       <button 
                        onClick={() => { setSelectedTemplate(tmp); loadEmployees(); setShowSendForm(true); }}
                        className="w-full py-2.5 bg-[#F8F7F9] hover:bg-[#F3E8FF] text-[#534AB7] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                       >
                         <Send size={12} strokeWidth={3} /> Send to Staff
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden animate-in fade-in duration-500">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                    <th className="px-6 py-4">Document Title</th>
                    <th className="px-6 py-4">Assigned To</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Sent Date</th>
                    <th className="px-6 py-4 text-right px-8">Signature Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F0F4]">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Tracking Documents...</td></tr>
                  ) : sentDocuments.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-[#9CA3AF] italic text-xs">No documents have been sent for signing yet.</td></tr>
                  ) : (
                    sentDocuments.map(doc => (
                      <tr key={doc.id} className="hover:bg-[#F8F7F9] transition-all group">
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-black text-[#1A1727] group-hover:text-[#534AB7] transition-colors">{doc.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-bold text-[#374151]">{doc.employee?.first_name} {doc.employee?.last_name}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 w-fit mx-auto ${
                            doc.status === 'signed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            doc.status === 'declined' ? 'bg-red-50 text-red-600 border-red-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            <div className="w-1 h-1 rounded-full bg-current" />
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="text-[11px] font-bold text-[#9CA3AF]">{new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                        </td>
                        <td className="px-6 py-4 text-right px-8">
                           <div className="text-[11px] font-black text-[#1A1727]">{doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-[#D1D5DB] font-bold uppercase tracking-widest text-[9px]">Awaiting</span>}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form Dialogs (reusing system patterns) */}
        {showTemplateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full shadow-2xl border border-[#F1F0F4] max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingTemplate ? 'Edit' : 'New'} Template</h2>
                <button onClick={() => setShowTemplateForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSaveTemplate} className="space-y-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Template Name</label>
                  <input required value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" placeholder="e.g. Employment Contract v2" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Internal Description</label>
                  <input value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" placeholder="Short summary for HR team..." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Document Content (HTML/Markdown supported)</label>
                  <textarea required value={templateForm.content} onChange={e => setTemplateForm({...templateForm, content: e.target.value})} rows={10} className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all resize-none font-mono" placeholder="Paste your legal text here..." />
                </div>
              </form>
              <div className="flex gap-4 pt-8 shrink-0">
                  <button type="button" onClick={() => setShowTemplateForm(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save Template</button>
              </div>
            </div>
          </div>
        )}

        {showSendForm && selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Send Document</h2>
                <button onClick={() => setShowSendForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727]"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSendDocument} className="space-y-6">
                <div className="p-4 bg-[#F3E8FF] rounded-2xl border border-purple-100 mb-2">
                   <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest mb-1">Target Template</div>
                   <div className="text-[14px] font-black text-[#1A1727]">{selectedTemplate.name}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Choose Employee</label>
                  <select required value={sendForm.employeeId} onChange={e => setSendForm({...sendForm, employeeId: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none">
                    <option value="">Select individual...</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_number})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Private Note (Optional)</label>
                  <textarea value={sendForm.notes} onChange={e => setSendForm({...sendForm, notes: e.target.value})} rows={2} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none" placeholder="e.g. Please sign by EOD Friday." />
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowSendForm(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"><Send size={14} strokeWidth={3} /> Send Now</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
