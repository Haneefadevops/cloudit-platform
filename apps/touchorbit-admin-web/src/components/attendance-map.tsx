'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { Map as MapIcon, Users, ShieldAlert, Layers, MapPin } from 'lucide-react'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Geofence {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
}

interface EmployeePin {
  id: string
  name: string
  initials: string
  status: 'present' | 'late' | 'absent' | 'break' | 'completed'
  workType: 'office' | 'wfh' | 'field' | null
  latitude: number
  longitude: number
  selfieUrl: string | null
  gpsAccuracy: number | null
  suspicious: boolean
  clockInTime: string | null
  department?: string | null
}

interface RoutePoint {
  latitude: number
  longitude: number
  type: string
  timestamp: string
}

interface Props {
  geofences: Geofence[]
  employees: EmployeePin[]
  selectedEmployeeId?: string | null
  onEmployeeSelect?: (id: string) => void
  selectedRoute?: RoutePoint[]
  resetSignal?: number
  showLayerControls?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  present: '#10B981',
  late: '#F59E0B',
  absent: '#EF4444',
  break: '#534AB7',
  completed: '#3B82F6',
}

function getDepartmentColor(dept?: string | null) {
  if (!dept) return '#9CA3AF'
  let hash = 0
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash)
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase()
  return '#' + '00000'.substring(0, 6 - c.length) + c
}

const WORK_TYPE_LABEL: Record<string, string> = {
  office: '🏢 Office',
  wfh: '🏠 WFH',
  field: '🚗 Field',
}

function createSelfieIcon(pin: EmployeePin, isSelected: boolean, useDeptColor: boolean) {
  const color = useDeptColor ? getDepartmentColor(pin.department) : (STATUS_COLORS[pin.status] || '#9CA3AF')
  const inner = pin.selfieUrl
    ? `<img src="${pin.selfieUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<div style="width:100%;height:100%;border-radius:50%;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#534AB7;font-family:'Plus Jakarta Sans',sans-serif;">${pin.initials}</div>`

  const html = `
    <div style="
      width:${isSelected ? '54px' : '44px'};
      height:${isSelected ? '54px' : '44px'};
      border-radius:50%;
      border:3px solid ${color};
      box-shadow:0 2px 12px rgba(0,0,0,0.25);
      overflow:hidden;
      background:white;
      position:relative;
      transition: all 0.2s ease-in-out;
      ${isSelected ? 'transform: scale(1.1); ring: 4px solid rgba(83, 74, 183, 0.4);' : ''}
    ">
      ${inner}
      ${pin.suspicious ? `
        <div style="
          position:absolute;bottom:0;right:0;
          width:16px;height:16px;background:#EF4444;
          border-radius:50%;border:2px solid white;
          display:flex;align-items:center;justify-content:center;
          color:white;font-size:8px;font-weight:900;
        ">!</div>
      ` : ''}
    </div>
  `
  return L.divIcon({ 
    html, 
    className: '', 
    iconSize: isSelected ? [54, 54] : [44, 44], 
    iconAnchor: isSelected ? [27, 27] : [22, 22], 
    popupAnchor: [0, -24] 
  })
}

function getHeadOffice(geofences: Geofence[]) {
  return geofences.find(g => /head|main|office/i.test(g.name)) || geofences[0] || null
}

function MapCenter({ geofences, employees, resetSignal }: { geofences: Geofence[], employees: EmployeePin[], resetSignal: number }) {
  const map = useMap()
  const hasInitialFit = useRef(false)

  useEffect(() => {
    if (hasInitialFit.current) return

    if (geofences.length === 0 && employees.length === 0) return

    const lats = [...geofences.map(g => g.latitude), ...employees.filter(e => e.latitude != null).map(e => e.latitude!)]
    const lngs = [...geofences.map(g => g.longitude), ...employees.filter(e => e.longitude != null).map(e => e.longitude!)]

    if (lats.length === 0) return

    const bounds = L.latLngBounds(lats.map((lat, i) => [lat, lngs[i]]))
    map.fitBounds(bounds, { padding: [50, 50] })
    hasInitialFit.current = true
  }, [geofences, employees, map])

  useEffect(() => {
    if (resetSignal === 0) return
    const headOffice = getHeadOffice(geofences)
    if (headOffice) {
      map.setView([headOffice.latitude, headOffice.longitude], 15, { animate: true })
    } else {
      map.setView([7.8731, 80.7718], 8, { animate: true })
    }
  }, [geofences, map, resetSignal])

  return null
}

function MapZoomControls() {
  const map = useMap()

  return (
    <div className="absolute bottom-16 right-4 z-[1000] flex flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-xl backdrop-blur-md">
      <button
        onClick={() => map.zoomIn()}
        className="flex h-10 w-10 items-center justify-center text-lg font-black text-[#534AB7] transition-all hover:bg-[#F8F6FF] hover:text-[#1E1854]"
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
      <div className="h-px bg-[#F1F0F4]" />
      <button
        onClick={() => map.zoomOut()}
        className="flex h-10 w-10 items-center justify-center text-lg font-black text-[#534AB7] transition-all hover:bg-[#F8F6FF] hover:text-[#1E1854]"
        title="Zoom out"
        aria-label="Zoom out"
      >
        -
      </button>
    </div>
  )
}

export default function AttendanceMap({ geofences, employees, selectedEmployeeId, onEmployeeSelect, selectedRoute, resetSignal = 0, showLayerControls = false }: Props) {
  const [showGeofences, setShowGeofences] = useState(true)
  const [showBranchZones, setShowBranchZones] = useState(false)
  const [showPins, setShowPins] = useState(true)
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false)
  const [showDepartments, setShowDepartments] = useState(false)
  const [internalResetSignal, setInternalResetSignal] = useState(0)

  const defaultCenter: [number, number] = [7.8731, 80.7718]
  const initialCenter: [number, number] = geofences.length > 0
    ? [geofences[0].latitude, geofences[0].longitude]
    : defaultCenter

  const mappable = employees.filter(e => e.latitude != null && e.longitude != null && (!showSuspiciousOnly || e.suspicious))

  // Simple "clustering" - if multiple people at same spot, offset them slightly
  const positions: Record<string, number> = {}
  const getOffsetPosition = (lat: number, lng: number): [number, number] => {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
    positions[key] = (positions[key] || 0) + 1
    if (positions[key] === 1) return [lat, lng]
    
    const count = positions[key] - 1
    const angle = (count * 137.5) * (Math.PI / 180)
    const radius = 0.0001 * Math.sqrt(count)
    return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)]
  }

  return (
    <div className="relative w-full h-full group">
      <MapContainer
        center={initialCenter}
        zoom={geofences.length > 0 ? 14 : 8}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenter geofences={geofences} employees={employees} resetSignal={resetSignal + internalResetSignal} />
        <MapZoomControls />

        {/* Geofence zones */}
        {showGeofences && geofences.map(g => (
          <Circle
            key={g.id}
            center={[g.latitude, g.longitude]}
            radius={g.radius_meters}
            pathOptions={{ 
              color: '#534AB7', 
              fillColor: '#534AB7', 
              fillOpacity: 0.06, 
              weight: 2, 
              dashArray: '6 4' 
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1A1727' }}>{g.name}</div>
                <div style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600 }}>{g.radius_meters}m radius · Primary Zone</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Branch zones use the same geofence data until distinct branch polygons exist. */}
        {showBranchZones && geofences.map(g => (
          <Circle
            key={`branch-${g.id}`}
            center={[g.latitude, g.longitude]}
            radius={g.radius_meters}
            pathOptions={{
              color: '#F59E0B',
              fillColor: '#F59E0B',
              fillOpacity: 0.04,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1A1727' }}>{g.name}</div>
                <div style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600 }}>Branch zone from geofence data</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Selected Employee Route Trace */}
        {selectedEmployeeId && selectedRoute && selectedRoute.length > 1 && (
          <>
            <Polyline 
              positions={selectedRoute.map(p => [p.latitude, p.longitude])}
              pathOptions={{ color: '#534AB7', weight: 3, opacity: 0.6, dashArray: '10, 10' }}
            />
            {selectedRoute.map((p, i) => (
              <CircleMarker 
                key={i} 
                center={[p.latitude, p.longitude]} 
                radius={4}
                pathOptions={{ fillColor: '#534AB7', color: 'white', weight: 2, fillOpacity: 1 }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    <div style={{ fontWeight: 800, fontSize: 11, color: '#1A1727' }}>{p.type}</div>
                    <div style={{ color: '#9CA3AF', fontSize: 10 }}>{new Date(p.timestamp).toLocaleTimeString()}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}

        {/* Employee selfie markers */}
        {showPins && mappable.map((e) => {
          const isSelected = selectedEmployeeId === e.id
          const pos = getOffsetPosition(e.latitude, e.longitude)
          
          return (
            <Marker 
              key={e.id} 
              position={pos} 
              icon={createSelfieIcon(e, isSelected, showDepartments)}
            >
              <Popup className="attendance-popup">
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', minWidth: 160, padding: '4px 0' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F8F7F9] overflow-hidden border border-[#F1F0F4] shrink-0">
                      {e.selfieUrl ? (
                        <img src={e.selfieUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-black text-[#534AB7] bg-[#F3E8FF] text-xs">
                          {e.initials}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div style={{ fontWeight: 900, fontSize: 13, color: '#1A1727', lineHeight: 1.2 }}>{e.name}</div>
                      <div style={{ color: STATUS_COLORS[e.status], fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                        {e.status}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-[#9CA3AF]">Clock In</span>
                      <span className="text-[#374151]">{e.clockInTime ? new Date(e.clockInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-[#9CA3AF]">Accuracy</span>
                      <span className={e.gpsAccuracy != null && e.gpsAccuracy < 50 ? 'text-emerald-600' : 'text-amber-600'}>
                        {e.gpsAccuracy != null ? `±${e.gpsAccuracy.toFixed(0)}m` : '—'}
                      </span>
                    </div>
                    {e.workType && (
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-[#9CA3AF]">Work Mode</span>
                        <span className="text-[#374151]">{WORK_TYPE_LABEL[e.workType]}</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => onEmployeeSelect?.(e.id)}
                    className="w-full py-2 bg-[#534AB7] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all"
                  >
                    Open Details
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Map Controls Overlay */}
      {showLayerControls && (
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-1.5 flex flex-col gap-1 overflow-hidden">
          {[
            { id: 'geofences', icon: MapIcon, active: showGeofences, set: setShowGeofences, label: 'Zones', title: 'Show geofence circles' },
            { id: 'branch-zones', icon: MapPin, active: showBranchZones, set: setShowBranchZones, label: 'Branch Zones', title: 'Show branch zones using geofence data' },
            { id: 'pins', icon: Users, active: showPins, set: setShowPins, label: 'Staff', title: 'Show employee pins' },
            { id: 'suspicious', icon: ShieldAlert, active: showSuspiciousOnly, set: setShowSuspiciousOnly, label: 'Alerts', title: 'Show suspicious employee pins only' },
            { id: 'dept', icon: Layers, active: showDepartments, set: setShowDepartments, label: 'Layers', title: 'Color staff pins by department' }
          ].map(ctrl => (
            <button
              key={ctrl.id}
              onClick={() => ctrl.set(!ctrl.active)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                ctrl.active 
                ? 'bg-[#534AB7] text-white shadow-lg shadow-purple-900/20' 
                : 'text-[#9CA3AF] hover:bg-[#F8F7F9] hover:text-[#374151]'
              }`}
              title={ctrl.title}
            >
              <ctrl.icon size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{ctrl.label}</span>
            </button>
          ))}
        </div>

        <button 
          onClick={() => {
            setShowGeofences(true); setShowBranchZones(false); setShowPins(true); setShowSuspiciousOnly(false); setShowDepartments(false);
          }}
          className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-xl border border-white/20 text-[#534AB7] hover:text-[#1E1854] transition-all flex items-center gap-2"
          title="Reset map layers"
        >
          <MapPin size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Reset Layers</span>
        </button>
      </div>
      )}

      <button
        onClick={() => setInternalResetSignal(value => value + 1)}
        className="absolute bottom-4 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-2xl border border-white/40 bg-white/95 text-[#534AB7] shadow-xl backdrop-blur-md transition-all hover:text-[#1E1854]"
        title="Reset View"
        aria-label="Reset map view"
      >
        <MapPin size={18} />
      </button>
    </div>
  )
}
