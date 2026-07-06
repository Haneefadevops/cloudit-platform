import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'

export function useAutoLinkAdmin() {
  const { userId, organizationId, isLoaded } = useAuth()
  const [isLinking, setIsLinking] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    // The user is authenticated against the platform API. If they have an
    // organization they are fully set up; otherwise flag that setup is needed.
    setIsLinked(!!userId)
    setNeedsSetup(!!userId && !organizationId)
  }, [userId, organizationId, isLoaded])

  return { isLinking, isLinked, needsSetup }
}
