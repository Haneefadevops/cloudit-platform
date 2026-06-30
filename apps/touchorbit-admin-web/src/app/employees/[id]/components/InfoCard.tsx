'use client'

import { Pencil, X, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface InfoCardProps {
  title: string
  icon: LucideIcon
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  children: React.ReactNode
  editForm: React.ReactNode
}

export function InfoCard({ title, icon: Icon, isEditing, onEdit, onSave, onCancel, children, editForm }: InfoCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#C7C3D0]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
          <Icon size={16} className="text-[#534AB7]" /> {title}
        </h3>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#534AB7] text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-colors"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F7F9] text-[#6B6578] rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-[#F1F0F4] transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="p-2 text-[#9994A8] hover:text-[#534AB7] hover:bg-[#F3E8FF] rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
      {isEditing ? editForm : children}
    </div>
  )
}
