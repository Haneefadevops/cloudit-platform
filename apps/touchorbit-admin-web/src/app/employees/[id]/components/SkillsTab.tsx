'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, X, Zap, Heart, Globe, Award } from 'lucide-react'

interface Skill {
  id: string
  skill_name: string
  category: 'technical' | 'soft_skill' | 'language' | 'certification'
  proficiency_level: number
}

interface SkillsTabProps {
  employeeId: string
  organizationId: string | null | undefined
  skills: Skill[]
  isLoading: boolean
  isAdmin: boolean
  onUpdate: () => void
}

const CATEGORY_CONFIG = {
  technical: { label: 'Technical', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', icon: Zap },
  soft_skill: { label: 'Soft Skill', color: 'bg-pink-50 text-pink-700 border-pink-200', dot: 'bg-pink-500', icon: Heart },
  language: { label: 'Language', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: Globe },
  certification: { label: 'Certification', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: Award },
}

function ProficiencyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`w-2 h-2 rounded-full transition-all ${
            n <= level ? 'bg-[#534AB7] shadow-[0_0_4px_rgba(83,74,183,0.4)]' : 'bg-[#E5E7EB]'
          }`}
        />
      ))}
    </div>
  )
}

function ProficiencyLabel({ level }: { level: number }) {
  const labels = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']
  return (
    <span className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
      {labels[level - 1] || '—'}
    </span>
  )
}

export function SkillsTab({ employeeId, organizationId, skills, isLoading, isAdmin, onUpdate }: SkillsTabProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ skill_name: '', category: 'technical' as Skill['category'], proficiency_level: 3 })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.skill_name.trim() || !organizationId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('employee_skills').insert({
        employee_id: employeeId,
        organization_id: organizationId,
        skill_name: form.skill_name.trim(),
        category: form.category,
        proficiency_level: form.proficiency_level,
      })
      if (error) throw error
      toast.success('Skill added')
      setForm({ skill_name: '', category: 'technical', proficiency_level: 3 })
      setShowAdd(false)
      onUpdate()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add skill')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(skillId: string) {
    try {
      const { error } = await supabase.from('employee_skills').delete().eq('id', skillId)
      if (error) throw error
      toast.success('Skill removed')
      onUpdate()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove skill')
    }
  }

  const grouped = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = []
    acc[skill.category].push(skill)
    return acc
  }, {} as Record<string, Skill[]>)

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-pulse font-black text-[#D1D5DB] uppercase tracking-widest text-[10px]">
        Loading skills...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Zap size={16} className="text-[#534AB7]" /> Skills & Competencies
          </h3>
          <p className="text-[11px] text-[#9994A8] font-bold mt-1">{skills.length} skill{skills.length !== 1 ? 's' : ''} recorded</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
          >
            <Plus size={13} strokeWidth={3} /> Add Skill
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-6 border border-[#C7C3D0] shadow-xl shadow-purple-900/5 space-y-4 animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Skill Name</label>
              <input
                required
                value={form.skill_name}
                onChange={(e) => setForm({ ...form, skill_name: e.target.value })}
                placeholder="e.g. React, Leadership"
                className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Skill['category'] })}
                className="w-full px-4 py-2.5 bg-white border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none"
              >
                <option value="technical">Technical</option>
                <option value="soft_skill">Soft Skill</option>
                <option value="language">Language</option>
                <option value="certification">Certification</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Proficiency (1–5)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.proficiency_level}
                  onChange={(e) => setForm({ ...form, proficiency_level: parseInt(e.target.value) })}
                  className="flex-1 accent-[#534AB7]"
                />
                <span className="text-sm font-black text-[#534AB7] w-6 text-center">{form.proficiency_level}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.skill_name.trim()}
              className="px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Skill'}
            </button>
          </div>
        </form>
      )}

      {/* Skills Grid */}
      {skills.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-12 text-center">
          <div className="w-14 h-14 bg-[#F8F7F9] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[13px] font-bold text-[#9CA3AF]">No skills recorded yet</p>
          {isAdmin && <p className="text-[11px] text-[#D1D5DB] font-bold mt-1">Click Add Skill to get started</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as Array<keyof typeof CATEGORY_CONFIG>).map((cat) => {
            const config = CATEGORY_CONFIG[cat]
            const Icon = config.icon
            const items = grouped[cat] || []
            return (
              <div key={cat} className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Icon size={14} className="text-[#534AB7]" />
                  <span className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest">{config.label}</span>
                  <span className="text-[10px] font-black text-[#9994A8] bg-[#F8F7F9] px-2 py-0.5 rounded-lg">{items.length}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {items.map((skill) => (
                    <div
                      key={skill.id}
                      className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${config.color} hover:shadow-md`}
                    >
                      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                      <span className="text-[12px] font-black">{skill.skill_name}</span>
                      <ProficiencyDots level={skill.proficiency_level} />
                      <ProficiencyLabel level={skill.proficiency_level} />
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(skill.id)}
                          className="ml-1 p-1 rounded-lg hover:bg-white/60 text-current opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove skill"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
