'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Info, AlertTriangle } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  content: string
  priority: 'normal' | 'important' | 'urgent'
  created_at: string
}

const priorityConfig = {
  normal: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  important: {
    icon: AlertCircle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  urgent: {
    icon: AlertTriangle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    badgeColor: 'bg-red-100 text-red-700',
  },
}

export function AnnouncementsFeed() {
  const { organizationId } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organizationId) {
      loadAnnouncements()
    }
  }, [organizationId])

  async function loadAnnouncements() {
    setLoading(true)

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(5) // Show latest 5 announcements

    if (error) {
      console.error('Error loading announcements:', error)
    } else {
      setAnnouncements(data || [])
    }

    setLoading(false)
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Announcements</h2>
        <div className="text-center text-gray-500 py-4">Loading...</div>
      </div>
    )
  }

  if (announcements.length === 0) {
    return null // Don't show section if no announcements
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Updates</h2>

      <div className="space-y-3">
        {announcements.map((announcement) => {
          const config = priorityConfig[announcement.priority]
          const Icon = config.icon

          return (
            <div
              key={announcement.id}
              className={`p-4 rounded-lg border-l-4 ${config.borderColor} ${config.bgColor}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded ${config.textColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {announcement.title}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(announcement.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
