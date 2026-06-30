'use client'

import { FileText, Image, FileSpreadsheet, ExternalLink } from 'lucide-react'

interface Document {
  id: string
  file_name: string
  title?: string
  file_url?: string
  document_type?: string
  created_at: string
}

interface DocumentsTabProps {
  documents: Document[]
  isLoading: boolean
}

function fileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['pdf'].includes(ext)) return { icon: FileText, color: 'text-red-500', bg: 'bg-red-50' }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: Image, color: 'text-blue-500', bg: 'bg-blue-50' }
  if (['doc', 'docx'].includes(ext)) return { icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-50' }
  return { icon: FileText, color: 'text-[#534AB7]', bg: 'bg-[#F3E8FF]' }
}

export function DocumentsTab({ documents, isLoading }: DocumentsTabProps) {
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm animate-pulse h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-12 shadow-sm text-center">
          <div className="w-14 h-14 bg-[#F8F7F9] rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText size={28} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[13px] font-bold text-[#9994A8]">No documents on file</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const { icon: Icon, color, bg } = fileIcon(doc.file_name)
          const name = doc.title || doc.file_name || 'Document'
          return (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm hover:shadow-md hover:border-[#534AB7]/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon size={18} className={color} />
                </div>
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-[#9994A8] hover:text-[#534AB7] hover:bg-[#F3E8FF] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <div className="text-[12.5px] font-bold text-[#1A1727] truncate mb-1" title={name}>
                {name}
              </div>
              <div className="text-[10px] font-bold text-[#9994A8] uppercase tracking-wider">
                {doc.document_type || 'File'} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
