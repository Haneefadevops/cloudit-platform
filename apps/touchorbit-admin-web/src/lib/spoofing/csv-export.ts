interface SpoofingExportData {
  timestamp: string
  employee_name: string
  latitude: number | null
  longitude: number | null
  gps_accuracy: number | null
  ip_address: string | null
  ip_city: string | null
  ip_country: string | null
  ip_distance_km: number | null
  suspicious_flags: string[] | null
  status: string
  reviewed_by: string | null
  review_notes: string | null
  selfie_url: string | null
}

export function exportSpoofingToCSV(data: SpoofingExportData[]) {
  const headers = [
    'Timestamp',
    'Employee Name',
    'Latitude',
    'Longitude',
    'GPS Accuracy',
    'IP Address',
    'IP City',
    'IP Country',
    'IP Distance (km)',
    'Suspicious Flags',
    'Status',
    'Reviewed By',
    'Review Notes',
    'Selfie URL'
  ]

  const rows = data.map(item => [
    item.timestamp,
    `"${item.employee_name}"`,
    item.latitude ?? '',
    item.longitude ?? '',
    item.gps_accuracy ?? '',
    item.ip_address ?? '',
    `"${item.ip_city ?? ''}"`,
    `"${item.ip_country ?? ''}"`,
    item.ip_distance_km ?? '',
    `"${(item.suspicious_flags ?? []).join(', ')}"`,
    item.status,
    `"${item.reviewed_by ?? ''}"`,
    `"${(item.review_notes ?? '').replace(/"/g, '""')}"`,
    item.selfie_url ?? ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `suspicious_punches_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
