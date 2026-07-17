'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { FileText, CheckCircle, Clock, X, FileSignature, ChevronRight, PenTool, ShieldCheck, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useAutoLinkEmployee } from '@/hooks/use-auto-link-employee'
import { EmployeeLayout } from '@/components/employee-layout'

interface SentDocument {
  id: string
  title: string
  content: string
  status: 'pending' | 'signed' | 'declined'
  signed_at: string | null
  created_at: string
  notes: string | null
}

export default function DocumentsPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLinked } = useAutoLinkEmployee()
  const [documents, setDocuments] = useState<SentDocument[]>([])
  const [selectedDoc, setSelectedDoc] = useState<SentDocument | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn && isLinked) {
      loadDocuments()
    } else if (isLoaded) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, isLinked])

  async function loadDocuments() {
    setLoading(true)
    try {
      const meRes = await api.get<{ id: string }>('/employees/me')
      if (!meRes.ok || !meRes.data?.id) { setLoading(false); return }
      const employeeId = meRes.data.id

      const res = await api.get<SentDocument[]>('/documents')
      if (res.ok && res.data) {
        setDocuments(res.data.filter((d: any) => d.employee_id === employeeId || d.employee?.id === employeeId))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleViewDocument(doc: SentDocument) {
    setSelectedDoc(doc)
    if (doc.status === 'pending') setShowSignature(false)
  }

  function startDrawing(e: any) {
    const canvas = canvasRef.current; if (!canvas) return
    setIsDrawing(true); setHasSignature(true)
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  function draw(e: any) {
    if (!isDrawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.strokeStyle = '#1A1727'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineTo(x, y); ctx.stroke()
  }

  async function handleSign() {
    if (!selectedDoc || !hasSignature) { toast.error('Signature missing'); return }
    const canvas = canvasRef.current; if (!canvas) return

    try {
      const signatureUrl = canvas.toDataURL('image/png')

      let latitude = null, longitude = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }))
        latitude = pos.coords.latitude; longitude = pos.coords.longitude
      } catch (e) {}

      const res = await api.patch<SentDocument>(`/documents/${selectedDoc.id}`, {
        status: 'signed',
        signature_url: signatureUrl,
        signed_at: new Date().toISOString(),
        signed_latitude: latitude,
        signed_longitude: longitude,
      })
      if (!res.ok) throw new Error(res.error || 'Signing failed')

      toast.success('Document signed!')
      if (res.data) setSelectedDoc(res.data)
      setShowSignature(false)
      loadDocuments()
    } catch (error: any) { toast.error('Signing failed: ' + (error?.message || 'Unknown error')) }
  }

  return (
    <EmployeeLayout showGreeting={false} title="Documents">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">My Documents</span>
            <FileSignature className="text-white/60" size={20} />
          </div>
          <div className="flex gap-4">
             <div className="bg-white/10 rounded-2xl p-4 flex-1 border border-white/5">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Awaiting</div>
                <div className="text-2xl font-black text-white">{documents.filter(d=>d.status === 'pending').length}</div>
             </div>
             <div className="bg-white/10 rounded-2xl p-4 flex-1 border border-white/5">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Signed</div>
                <div className="text-2xl font-black text-white">{documents.filter(d=>d.status === 'signed').length}</div>
             </div>
          </div>
        </div>

        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
            {loading ? (
              <div className="py-20 text-center text-[#9CA3AF] animate-pulse font-bold uppercase tracking-widest text-[10px]">Fetching Documents...</div>
            ) : documents.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                 <FileText size={40} className="text-[#D1D5DB] mb-4 opacity-20" />
                 <div className="text-sm font-bold text-[#9CA3AF]">No documents assigned to you</div>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} onClick={() => handleViewDocument(doc)} className="flex items-center gap-4 p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] active:scale-[0.98] transition-all cursor-pointer group">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${doc.status === 'signed' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                      {doc.status === 'signed' ? <ShieldCheck size={24} strokeWidth={2.5} /> : <PenTool size={24} strokeWidth={2.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                       <h3 className="text-[15px] font-black text-[#1A1727] truncate group-hover:text-[#534AB7] transition-colors">{doc.title}</h3>
                       <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${doc.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{doc.status === 'pending' ? 'Pending' : doc.status}</span>
                          <span className="text-[10px] font-bold text-[#D1D5DB] uppercase">{new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                       </div>
                    </div>
                    <ChevronRight size={18} className="text-[#D1D5DB]" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in slide-in-from-bottom-full duration-300">
             <div className="bg-[#1A1727] p-6 text-white flex items-center justify-between">
                <div>
                   <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Document Viewer</div>
                   <h2 className="text-xl font-black tracking-tight">{selectedDoc.title}</h2>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={20} strokeWidth={3} /></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12">
                {selectedDoc.notes && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-2xl">
                     <p className="text-[12px] text-blue-700 font-bold leading-relaxed">{selectedDoc.notes}</p>
                  </div>
                )}
                
                <div className="prose prose-sm max-w-none text-[#374151] leading-relaxed whitespace-pre-wrap font-medium border-b border-[#F1F0F4] pb-10">
                  {selectedDoc.content}
                </div>

                {selectedDoc.status === 'pending' && !showSignature && (
                   <button onClick={() => setShowSignature(true)} className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 active:scale-95 transition-all">Start Signing Process</button>
                )}

                {showSignature && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                     <div className="flex items-center justify-between px-1">
                        <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2"><PenTool size={14} /> Draw Signature</h3>
                        <button onClick={() => { const c = canvasRef.current; if(c) c.getContext('2d')?.clearRect(0,0,c.width,c.height); setHasSignature(false); }} className="text-[10px] font-bold text-red-500 uppercase">Clear</button>
                     </div>
                     <div className="bg-[#F8F7F9] border-2 border-dashed border-[#D1D5DB] rounded-[32px] overflow-hidden shadow-inner">
                        <canvas ref={canvasRef} width={600} height={250} className="w-full touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} />
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-[#9CA3AF] font-bold justify-center"><MapPin size={10} /> GPS Location & Timestamp will be recorded</div>
                     <button onClick={handleSign} disabled={!hasSignature} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50">Complete & Secure Document</button>
                  </div>
                )}

                {selectedDoc.status === 'signed' && (
                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[32px] flex flex-col items-center text-center">
                     <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm mb-4"><CheckCircle size={32} strokeWidth={2.5} /></div>
                     <h4 className="text-emerald-800 font-black text-lg uppercase tracking-tight">Verified & Signed</h4>
                     <p className="text-emerald-600/80 text-xs font-bold mt-1 uppercase tracking-widest">Recorded on {new Date(selectedDoc.signed_at!).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  )
}
