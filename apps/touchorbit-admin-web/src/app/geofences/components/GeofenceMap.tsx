'use client'

import { useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLngExpression } from 'leaflet'

interface Geofence {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  status: 'active' | 'inactive'
  created_at: string
}

const ZONE_COLORS = [
  '#534AB7', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1',
]

export function getZoneColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return ZONE_COLORS[Math.abs(hash) % ZONE_COLORS.length]
}

function FlyToZone({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo(center, zoom, { duration: 1 }) }, [center, zoom, map])
  return null
}

function MapClickHandler({ enabled, onClick }: { enabled: boolean; onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { if (enabled) onClick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

interface GeofenceMapProps {
  geofences: Geofence[]
  selected: Geofence | null
  mapCenter: LatLngExpression
  mapZoom: number
  darkTiles: boolean
  dropPinMode: boolean
  previewPos: { lat: number; lng: number } | null
  previewRadius: number
  onSelectZone: (g: Geofence) => void
  onMapClick: (lat: number, lng: number) => void
}

export function GeofenceMap({
  geofences,
  selected,
  mapCenter,
  mapZoom,
  darkTiles,
  dropPinMode,
  previewPos,
  previewRadius,
  onSelectZone,
  onMapClick,
}: GeofenceMapProps) {
  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <FlyToZone center={mapCenter} zoom={mapZoom} />
      <MapClickHandler enabled={dropPinMode} onClick={onMapClick} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={darkTiles
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        }
      />

      {geofences.map(g => {
        const color = getZoneColor(g.id)
        const isSelected = selected?.id === g.id
        return (
          <Circle
            key={g.id}
            center={[g.latitude, g.longitude]}
            radius={g.radius_meters}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: isSelected ? 0.15 : 0.08,
              weight: isSelected ? 3 : 2,
              dashArray: isSelected ? undefined : '4 4',
            }}
            eventHandlers={{ click: () => onSelectZone(g) }}
          />
        )
      })}

      {previewPos && (
        <Circle
          center={[previewPos.lat, previewPos.lng]}
          radius={previewRadius}
          pathOptions={{
            color: '#534AB7',
            fillColor: '#534AB7',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '6 3',
          }}
        />
      )}
    </MapContainer>
  )
}
