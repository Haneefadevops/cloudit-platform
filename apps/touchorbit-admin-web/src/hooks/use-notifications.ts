import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export interface Notification {
  id: string
  user_id: string
  organization_id: string
  type: string
  title: string
  message: string
  read: boolean
  data_json: any
  created_at: string
}

export function useNotifications() {
  const { userId, organizationId, isLoaded } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const canLoadNotifications = Boolean(userId && organizationId)

  const loadNotifications = async () => {
    if (!canLoadNotifications) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(!isLoaded)
      return
    }

    setLoading(true)
    try {
      const res = await api.get<Notification[]>('/notifications')
      const data = res.data || []
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!canLoadNotifications) return

    try {
      const res = await api.patch<Notification>(`/notifications/${notificationId}/read`, {})
      if (!res.ok) throw new Error(res.error || 'Failed')

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!canLoadNotifications) return

    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
      await Promise.all(unreadIds.map(id => api.patch<Notification>(`/notifications/${id}/read`, {})))

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    if (!canLoadNotifications) return

    try {
      const res = await api.del<{ id: string }>(`/notifications/${notificationId}`)
      if (!res.ok) throw new Error(res.error || 'Failed')

      const wasUnread = notifications.find(n => n.id === notificationId)?.read === false
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  useEffect(() => {
    if (!canLoadNotifications) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(!isLoaded)
      return
    }

    loadNotifications()
  }, [canLoadNotifications, isLoaded, organizationId, userId])

  return {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }
}
