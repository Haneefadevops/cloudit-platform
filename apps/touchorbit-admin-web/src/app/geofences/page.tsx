'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { supabase } from '@/lib/supabase'
import {
  MapPin, Plus, Search, X, Layers,
  Radio, CheckCircle2, Trash2, Pencil, Crosshair,
  ChevronRight, LocateFixed, Ruler
} from 'lucide-react'
import { toast } from 'sonner'
import { getZoneColor } from './components/GeofenceMap'

const GeofenceMap = dynamic(() => import('./components/GeofenceMap').then(m => ({ default: m.GeofenceMap })), { ssr: false })

interface Geofence {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  status: 'active' | 'inactive'
  created_at: string
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, tone = 'default' }: { icon: any; label: string; value: string | number; tone?: 'default' | 'emerald' | 'amber' | 'blue' }) {
  const toneStyles = {
    default: 'bg-white text-[#1A1727]',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#F1F0F4] shadow-sm ${toneStyles[tone]}`}>
      <div className="w-8 h-8 rounded-lg bg-[#F8F7F9] flex items-center justify-center shrink-0">
        <Icon size={14} className="text-[#534AB7]" strokeWidth={2.5} />
      </div>
      <div>
        <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">{label}</div>
        <div className="text-[13px] font-black">{value}</div>
      </div>
    </div>
  )
}

export default function GeofencesPage() {
  const { organizationId, isLoaded } = useAuth()
  const { can } = usePermissions(['geofences.manage'])
  const canManage = can('geofences.manage')

  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selected, setSelected] = useState<Geofence | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.9271, 79.8612])
  const [mapZoom, setMapZoom] = useState(13)
  const [darkTiles, setDarkTiles] = useState(false)

  /* Form / Panel state */
  const [showPanel, setShowPanel] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dropPinMode, setDropPinMode] = useState(false)
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: '200', status: 'active' as 'active' | 'inactive' })
  const [previewPos, setPreviewPos] = useState<{ lat: number; lng: number } | null>(null)

  /* Inline edit state for selected zone floating card */
  const [inlineEditing, setInlineEditing] = useState(false)
  const [inlineForm, setInlineForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: '200', status: 'active' as 'active' | 'inactive' })

  /* Load data */
  const loadGeofences = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('geofences')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load geofences')
    } else {
      setGeofences(data || [])
      if (data && data.length > 0 && !selected) {
        setSelected(data[0])
        setMapCenter([data[0].latitude, data[0].longitude])
        setMapZoom(14)
      }
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => {
    if (isLoaded && organizationId) loadGeofences()
  }, [isLoaded, organizationId, loadGeofences])

  /* Stats */
  const stats = useMemo(() => {
    const active = geofences.filter(g => g.status === 'active').length
    const totalArea = geofences.reduce((sum, g) => sum + Math.PI * (g.radius_meters / 1000) ** 2, 0)
    const avgRadius = geofences.length > 0 ? Math.round(geofences.reduce((s, g) => s + g.radius_meters, 0) / geofences.length) : 0
    return { active, totalArea: totalArea.toFixed(2), avgRadius }
  }, [geofences])

  /* Filtered list */
  const filtered = useMemo(() => {
    return geofences.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || g.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [geofences, search, statusFilter])

  /* Handlers */
  const openNewPanel = useCallback(() => {
    setForm({ name: '', latitude: '', longitude: '', radius_meters: '200', status: 'active' })
    setPreviewPos(null)
    setEditingId(null)
    setShowPanel(true)
    setDropPinMode(false)
  }, [])

  const openEditPanel = useCallback((g: Geofence) => {
    setForm({
      name: g.name,
      latitude: g.latitude.toString(),
      longitude: g.longitude.toString(),
      radius_meters: g.radius_meters.toString(),
      status: g.status,
    })
    setPreviewPos({ lat: g.latitude, lng: g.longitude })
    setEditingId(g.id)
    setShowPanel(true)
    setDropPinMode(false)
  }, [])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setForm(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
    setPreviewPos({ lat, lng })
    setDropPinMode(false)
    toast.success('Pin dropped — coordinates set')
  }, [])

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setForm(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
        setPreviewPos({ lat, lng })
        setMapCenter([lat, lng])
        setMapZoom(16)
        toast.success('Location detected')
      },
      (err) => toast.error('Failed: ' + err.message)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return
    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)
    const radius = parseInt(form.radius_meters)
    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) { toast.error('Invalid coordinates or radius'); return }

    try {
      if (editingId) {
        const { error } = await supabase.from('geofences').update({ name: form.name, latitude: lat, longitude: lng, radius_meters: radius, status: form.status }).eq('id', editingId)
        if (error) throw error
        toast.success('Zone updated')
      } else {
        const { error } = await supabase.from('geofences').insert({ organization_id: organizationId, name: form.name, latitude: lat, longitude: lng, radius_meters: radius, status: form.status })
        if (error) throw error
        toast.success('Zone created')
      }
      setShowPanel(false)
      setPreviewPos(null)
      loadGeofences()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this geofence?')) return
    const { error } = await supabase.from('geofences').delete().eq('id', id)
    if (error) toast.error('Delete failed')
    else { toast.success('Deleted'); if (selected?.id === id) setSelected(null); loadGeofences() }
  }

  const startInlineEdit = useCallback(() => {
    if (!selected) return
    setInlineForm({
      name: selected.name,
      latitude: selected.latitude.toString(),
      longitude: selected.longitude.toString(),
      radius_meters: selected.radius_meters.toString(),
      status: selected.status,
    })
    setInlineEditing(true)
  }, [selected])

  const cancelInlineEdit = useCallback(() => {
    setInlineEditing(false)
  }, [])

  const saveInlineEdit = async () => {
    if (!selected) return
    const lat = parseFloat(inlineForm.latitude)
    const lng = parseFloat(inlineForm.longitude)
    const radius = parseInt(inlineForm.radius_meters)
    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) { toast.error('Invalid coordinates or radius'); return }

    try {
      const { error } = await supabase.from('geofences').update({
        name: inlineForm.name,
        latitude: lat,
        longitude: lng,
        radius_meters: radius,
        status: inlineForm.status,
      }).eq('id', selected.id)
      if (error) throw error
      toast.success('Zone updated')
      setInlineEditing(false)
      setSelected(prev => prev ? { ...prev, name: inlineForm.name, latitude: lat, longitude: lng, radius_meters: radius, status: inlineForm.status } : null)
      loadGeofences()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    }
  }

  const handleSelectZone = (g: Geofence) => {
    setSelected(g)
    setMapCenter([g.latitude, g.longitude])
    setMapZoom(15)
  }

  const previewRadius = parseInt(form.radius_meters) || 200

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#ECECF1] font-['Plus_Jakarta_Sans']">
        {/* KPI Strip */}
        <div className="bg-white border-b border-[#C7C3D0] px-6 py-3 flex items-center gap-3 shrink-0 overflow-x-auto">
          <StatCard icon={MapPin} label="Total Zones" value={geofences.length} />
          <StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="emerald" />
          <StatCard icon={Ruler} label="Coverage" value={`${stats.totalArea} km²`} />
          <StatCard icon={Radio} label="Avg Radius" value={`${stats.avgRadius}m`} />
          <div className="flex-1" />
          {canManage && (
            <button onClick={openNewPanel} className="flex items-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all shrink-0">
              <Plus size={13} strokeWidth={3} /> Add Zone
            </button>
          )}
        </div>

        {/* Main Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          <div className="w-80 bg-white border-r border-[#C7C3D0] flex flex-col shrink-0">
            {/* Search + Filters */}
            <div className="p-4 border-b border-[#F1F0F4] space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search zones..."
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-[12px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'active', 'inactive'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      statusFilter === f
                        ? 'bg-[#1A1727] text-white'
                        : 'bg-[#F8F7F9] text-[#9994A8] hover:bg-[#F1F0F4]'
                    }`}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-12 text-center animate-pulse font-black text-[#D1D5DB] uppercase tracking-widest text-[10px]">Loading zones...</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 bg-[#F8F7F9] rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <MapPin size={24} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] font-bold text-[#9CA3AF]">No zones found</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F8F7F9]">
                  {filtered.map(g => {
                    const color = getZoneColor(g.id)
                    const isSelected = selected?.id === g.id
                    return (
                      <div
                        key={g.id}
                        onClick={() => handleSelectZone(g)}
                        className={`p-4 cursor-pointer transition-all border-l-[3px] ${
                          isSelected ? 'bg-[#F3E8FF] border-[#534AB7]' : 'hover:bg-[#F8F7F9] border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <div className="text-[13px] font-black text-[#1A1727] truncate">{g.name}</div>
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            g.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {g.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9994A8] font-bold truncate pl-5">{g.latitude.toFixed(5)}, {g.longitude.toFixed(5)}</div>
                        <div className="flex items-center justify-between mt-2 pl-5">
                          <span className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest">{g.radius_meters}m radius</span>
                          <ChevronRight size={12} className={`text-[#D1D5DB] transition-all ${isSelected ? 'text-[#534AB7] translate-x-0.5' : ''}`} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Map Panel */}
          <div className={`flex-1 relative bg-[#E5E3F0] ${dropPinMode ? '[&_.leaflet-container]:cursor-crosshair' : ''}`}>
            {/* Drop Pin Mode Banner */}
            {dropPinMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] px-5 py-2.5 bg-[#534AB7] text-white rounded-xl shadow-xl shadow-purple-900/30 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <MapPin size={14} strokeWidth={2.5} />
                <span className="text-[11px] font-black uppercase tracking-widest">Click anywhere on the map to drop pin</span>
                <button
                  onClick={() => setDropPinMode(false)}
                  className="ml-2 p-1 rounded-lg hover:bg-white/20 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <GeofenceMap
              geofences={geofences}
              selected={selected}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              darkTiles={darkTiles}
              dropPinMode={dropPinMode}
              previewPos={previewPos}
              previewRadius={previewRadius}
              onSelectZone={handleSelectZone}
              onMapClick={handleMapClick}
            />

            {/* Floating Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={() => setDarkTiles(!darkTiles)}
                className="w-10 h-10 bg-white rounded-xl shadow-lg border border-[#F1F0F4] flex items-center justify-center text-[#1A1727] hover:bg-[#F8F7F9] transition-all"
                title="Toggle map style"
              >
                <Layers size={16} />
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    setMapCenter([selected.latitude, selected.longitude])
                    setMapZoom(15)
                  }
                }}
                className="w-10 h-10 bg-white rounded-xl shadow-lg border border-[#F1F0F4] flex items-center justify-center text-[#1A1727] hover:bg-[#F8F7F9] transition-all"
                title="Center selected"
              >
                <LocateFixed size={16} />
              </button>
            </div>

            {/* Selected Zone Detail — Floating Card */}
            {selected && (
              <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-[#C7C3D0] z-[500] animate-in slide-in-from-bottom-4 duration-300 ${inlineEditing ? 'w-[460px] p-6' : 'w-[400px] p-5'}`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getZoneColor(selected.id) }} />
                    <div>
                      {inlineEditing ? (
                        <input
                          value={inlineForm.name}
                          onChange={e => setInlineForm(prev => ({ ...prev, name: e.target.value }))}
                          className="text-[14px] font-black text-[#1A1727] bg-[#F8F7F9] border border-[#C7C3D0] rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#534AB7]/20 w-48"
                        />
                      ) : (
                        <div className="text-[14px] font-black text-[#1A1727]">{selected.name}</div>
                      )}
                      <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">{selected.status} · {selected.radius_meters}m radius</div>
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setInlineEditing(false) }} className="p-1.5 text-[#D1D5DB] hover:text-[#1A1727] rounded-lg hover:bg-[#F8F7F9] transition-all">
                    <X size={14} />
                  </button>
                </div>

                {/* Status toggle — always visible */}
                {canManage && !inlineEditing && (
                  <div className="mb-3">
                    <div className="flex gap-2">
                      {(['active', 'inactive'] as const).map(s => (
                        <button
                          key={s}
                          onClick={async () => {
                            if (selected.status === s) return
                            const { error } = await supabase.from('geofences').update({ status: s }).eq('id', selected.id)
                            if (error) { toast.error('Failed to update status'); return }
                            toast.success(`Zone ${s}`)
                            setSelected(prev => prev ? { ...prev, status: s } : null)
                            loadGeofences()
                          }}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            selected.status === s
                              ? s === 'active'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-gray-50 border-gray-200 text-gray-500'
                              : 'bg-white border-[#F1F0F4] text-[#9994A8] hover:bg-[#F8F7F9]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline edit mode fields */}
                {inlineEditing ? (
                  <div className="space-y-4 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest mb-1 block">Latitude</label>
                        <input
                          value={inlineForm.latitude}
                          onChange={e => {
                            setInlineForm(prev => ({ ...prev, latitude: e.target.value }))
                            const lat = parseFloat(e.target.value)
                            const lng = parseFloat(inlineForm.longitude)
                            if (!isNaN(lat)) setPreviewPos({ lat, lng: isNaN(lng) ? 0 : lng })
                          }}
                          className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-[12px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest mb-1 block">Longitude</label>
                        <input
                          value={inlineForm.longitude}
                          onChange={e => {
                            setInlineForm(prev => ({ ...prev, longitude: e.target.value }))
                            const lng = parseFloat(e.target.value)
                            const lat = parseFloat(inlineForm.latitude)
                            if (!isNaN(lng)) setPreviewPos({ lat: isNaN(lat) ? 0 : lat, lng })
                          }}
                          className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-[12px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest">Radius</label>
                        <span className="text-[12px] font-black text-[#534AB7]">{parseInt(inlineForm.radius_meters) || 200}m</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={2000}
                        step={50}
                        value={parseInt(inlineForm.radius_meters) || 200}
                        onChange={e => setInlineForm(prev => ({ ...prev, radius_meters: e.target.value }))}
                        className="w-full accent-[#534AB7]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest mb-1 block">Status</label>
                      <div className="flex gap-2">
                        {(['active', 'inactive'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setInlineForm(prev => ({ ...prev, status: s }))}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                              inlineForm.status === s
                                ? s === 'active'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-gray-50 border-gray-200 text-gray-500'
                                : 'bg-white border-[#F1F0F4] text-[#9994A8] hover:bg-[#F8F7F9]'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Read-only coords */
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Latitude', value: selected.latitude.toFixed(5) },
                      { label: 'Longitude', value: selected.longitude.toFixed(5) },
                      { label: 'Radius', value: `${selected.radius_meters}m` },
                    ].map(item => (
                      <div key={item.label} className="p-3 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                        <div className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">{item.label}</div>
                        <div className="text-[12px] font-black text-[#1A1727] truncate">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {canManage && (
                  <div className="flex gap-2">
                    {inlineEditing ? (
                      <>
                        <button onClick={cancelInlineEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F8F7F9] text-[#1A1727] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F1F0F4] transition-all">
                          <X size={12} /> Cancel
                        </button>
                        <button onClick={saveInlineEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all">
                          <CheckCircle2 size={12} /> Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={startInlineEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F8F7F9] text-[#1A1727] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F1F0F4] transition-all">
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => handleDelete(selected.id)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                          <Trash2 size={12} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* ─── Slide-over Panel ─── */}
        {showPanel && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 z-[1000] ${dropPinMode ? 'pointer-events-none' : 'bg-black/20 backdrop-blur-sm'}`}
              onClick={() => {
                if (!dropPinMode) {
                  setShowPanel(false)
                  setPreviewPos(null)
                  setDropPinMode(false)
                }
              }}
            />

            {dropPinMode ? (
              /* Minimized floating card */
              <div className="fixed bottom-6 right-6 z-[1010] w-[280px] bg-white rounded-2xl shadow-2xl border border-[#C7C3D0] p-5 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                    <MapPin size={14} className="text-[#534AB7]" />
                  </div>
                  <span className="text-[13px] font-black text-[#1A1727]">Drop Pin Mode</span>
                  <button
                    onClick={() => { setDropPinMode(false); setShowPanel(false); setPreviewPos(null) }}
                    className="ml-auto p-1 text-[#D1D5DB] hover:text-[#1A1727] rounded-lg hover:bg-[#F8F7F9] transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
                {previewPos ? (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <div className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest">Latitude</div>
                      <div className="text-[12px] font-black text-[#1A1727]">{previewPos.lat.toFixed(6)}</div>
                    </div>
                    <div className="p-2.5 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <div className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest">Longitude</div>
                      <div className="text-[12px] font-black text-[#1A1727]">{previewPos.lng.toFixed(6)}</div>
                    </div>
                    <div className="p-2.5 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <div className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest">Radius</div>
                      <div className="text-[12px] font-black text-[#1A1727]">{previewRadius}m</div>
                    </div>
                    <button
                      onClick={() => { setDropPinMode(false); }}
                      className="w-full mt-1 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
                    >
                      Confirm &amp; Close
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-[#9994A8]">Click anywhere on the map to place a pin.</p>
                )}
              </div>
            ) : (
              /* Full slide-over panel */
              <div className="fixed right-0 top-0 bottom-0 z-[1010] w-[420px] bg-white shadow-2xl border-l border-[#C7C3D0] flex flex-col animate-in slide-in-from-right-300 duration-300">
                {/* Header */}
                <div className="shrink-0 p-6 border-b border-[#F1F0F4] flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-black text-[#1A1727]">
                      {editingId ? 'Edit Zone' : 'Add Zone'}
                    </h3>
                    <p className="text-[11px] font-bold text-[#9994A8] mt-0.5">
                      {editingId ? 'Update geofence settings' : 'Define a new geofenced area'}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowPanel(false); setPreviewPos(null); setDropPinMode(false) }}
                    className="p-2 text-[#D1D5DB] hover:text-[#1A1727] rounded-xl hover:bg-[#F8F7F9] transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable form */}
                <div className="flex-1 overflow-y-auto p-6">
                  <form id="geofence-form" onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                      <label className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-2 block">Zone Name</label>
                      <input
                        value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Main Office"
                        className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-[13px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                        required
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-2 block">Status</label>
                      <div className="flex gap-2">
                        {(['active', 'inactive'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, status: s }))}
                            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                              form.status === s
                                ? s === 'active'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-gray-50 border-gray-200 text-gray-500'
                                : 'bg-white border-[#F1F0F4] text-[#9994A8] hover:bg-[#F8F7F9]'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Location helpers */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGetCurrentLocation}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-[11px] font-black text-[#1A1727] uppercase tracking-widest hover:bg-[#F1F0F4] transition-all"
                      >
                        <Crosshair size={12} /> Use My Location
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDropPinMode(true) }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                          dropPinMode
                            ? 'bg-[#534AB7] border-[#534AB7] text-white'
                            : 'bg-[#F8F7F9] border-[#F1F0F4] text-[#1A1727] hover:bg-[#F1F0F4]'
                        }`}
                      >
                        <MapPin size={12} /> Drop Pin
                      </button>
                    </div>

                    {/* Coordinates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-2 block">Latitude</label>
                        <input
                          value={form.latitude}
                          onChange={e => {
                            setForm(prev => ({ ...prev, latitude: e.target.value }))
                            const lat = parseFloat(e.target.value)
                            if (!isNaN(lat)) setPreviewPos({ lat, lng: parseFloat(form.longitude) || 0 })
                          }}
                          placeholder="6.9271"
                          className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-[13px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-2 block">Longitude</label>
                        <input
                          value={form.longitude}
                          onChange={e => {
                            setForm(prev => ({ ...prev, longitude: e.target.value }))
                            const lng = parseFloat(e.target.value)
                            if (!isNaN(lng)) setPreviewPos({ lat: parseFloat(form.latitude) || 0, lng })
                          }}
                          placeholder="79.8612"
                          className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-[13px] font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                          required
                        />
                      </div>
                    </div>

                    {/* Radius */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">Radius</label>
                        <span className="text-[13px] font-black text-[#534AB7]">{previewRadius}m</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={2000}
                        step={50}
                        value={previewRadius}
                        onChange={e => setForm(prev => ({ ...prev, radius_meters: e.target.value }))}
                        className="w-full accent-[#534AB7]"
                      />
                      <div className="flex justify-between text-[9px] font-black text-[#D1D5DB] mt-1">
                        <span>50m</span>
                        <span>2000m</span>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Footer buttons */}
                <div className="shrink-0 p-6 border-t border-[#F1F0F4] flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowPanel(false); setPreviewPos(null); setDropPinMode(false) }}
                    className="flex-1 py-3 bg-[#F8F7F9] text-[#1A1727] rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-[#F1F0F4] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="geofence-form"
                    className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[12px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
                  >
                    {editingId ? 'Save Changes' : 'Create Zone'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
