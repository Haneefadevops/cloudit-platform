'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { 
  Search, 
  ChevronRight, 
  Clock,
  X
} from 'lucide-react'

interface EmployeeResult {
  id: string
  first_name: string
  last_name: string
  department: string
  job_title: string
  employment_status: string
}

const quickFilters = ['Employees', 'Leave', 'Payslips', 'Overtime']

const recentSearchesSeed = ['Leave balance', 'Last payslip', 'Overtime request']

function getInitials(first: string, last: string) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase()
}

function stringToColor(str: string) {
  const colors = ['#534AB7', '#059669', '#D97706', '#2563EB', '#0891B2', '#7C3AED']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function SearchPage() {
  const router = useRouter()
  const { organizationId, isLoaded } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EmployeeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState('Employees')

  useEffect(() => {
    const saved = localStorage.getItem('touchorbit_recent_searches')
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)) } catch {}
    } else {
      setRecentSearches(recentSearchesSeed)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !organizationId) return
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => performSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, isLoaded, organizationId])

  const performSearch = async (q: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, department, job_title, employment_status')
        .eq('organization_id', organizationId)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(20)
      setResults(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const saveRecent = (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('touchorbit_recent_searches', JSON.stringify(updated))
  }

  return (
    <EmployeeLayout showGreeting={false} title="Search" hideHeader>
      <div className="flex flex-col min-h-screen bg-white font-['Plus_Jakarta_Sans'] pb-24">
        
        {/* Search Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <div className="flex items-center bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl px-4 py-3 gap-3 focus-within:border-[#534AB7] focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <Search size={18} className="text-[#534AB7]" strokeWidth={2} />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search employees..."
                  className="flex-1 bg-transparent text-[13.5px] font-medium text-[#1A1727] outline-none placeholder:text-[#9CA3AF]"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-[#9CA3AF] hover:text-[#1A1727]">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <button 
              onClick={() => router.back()}
              className="text-[13px] font-semibold text-[#9CA3AF] hover:text-[#1A1727]"
            >
              Cancel
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2 flex-wrap">
            {quickFilters.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                  activeFilter === f 
                    ? 'bg-[#534AB7] text-white' 
                    : 'bg-[#F8F7F9] text-[#9CA3AF] border border-[#F1F0F4]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4">
          {query.trim().length >= 2 && (
            <>
              <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 mt-2">
                Employees matching "{query}"
              </div>
              {loading ? (
                <div className="py-10 text-center text-[#9CA3AF]">Searching...</div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-[#9CA3AF]">No employees found</div>
              ) : (
                results.map(r => {
                  const color = stringToColor(r.id)
                  const isActive = r.employment_status === 'active'
                  return (
                    <div 
                      key={r.id} 
                      className="flex items-center gap-3 py-3 border-b border-[#F8F7F9] cursor-pointer active:scale-[0.98] transition-all"
                      onClick={() => saveRecent(query)}
                    >
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                        style={{ backgroundColor: color + '22', color }}
                      >
                        {getInitials(r.first_name, r.last_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold text-[#1A1727]">{r.first_name} {r.last_name}</div>
                        <div className="text-[11px] text-[#9CA3AF]">{r.department || r.job_title || '—'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )
                })
              )}
            </>
          )}

          {/* Recent Searches */}
          {query.trim().length < 2 && recentSearches.length > 0 && (
            <>
              <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 mt-2">
                Recent Searches
              </div>
              {recentSearches.map(r => (
                <div 
                  key={r}
                  className="flex items-center gap-3 py-3 border-b border-[#F8F7F9] cursor-pointer"
                  onClick={() => setQuery(r)}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#F8F7F9] flex items-center justify-center">
                    <Clock size={13} className="text-[#9CA3AF]" />
                  </div>
                  <span className="text-[13px] text-[#6B7280] font-medium">{r}</span>
                  <ChevronRight size={14} className="text-[#D1D5DB] ml-auto" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </EmployeeLayout>
  )
}
