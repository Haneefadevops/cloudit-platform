import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'

export function useAutoLinkEmployee() {
  const { userId, isLoaded } = useAuth()
  const [isLinking, setIsLinking] = useState(false)
  const [isLinked, setIsLinked] = useState(false)

  useEffect(() => {
    async function checkEmployeeIntegrity() {
      if (!isLoaded || !userId) return
      if (isLinking || isLinked) return

      setIsLinking(true)

      try {
        const result = await api.get<{ id: string }>('/employees/me')
        setIsLinked(result.ok && !!result.data?.id)
      } catch (error) {
        console.error('Employee integrity check failed:', error)
        setIsLinked(false)
      } finally {
        setIsLinking(false)
      }
    }

    checkEmployeeIntegrity()
  }, [userId, isLoaded])

  return { isLinking, isLinked }
}
