import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function useAutoLinkAdmin() {
  const { userId, isLoaded } = useAuth()
  const [isLinking, setIsLinking] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    async function checkAdminRecord() {
      if (!isLoaded || !userId) return
      if (isLinking || isLinked) return

      setIsLinking(true)

      try {
        // Just verify the profile exists in public.users
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single()

        if (userRecord) {
          setIsLinked(true)
        } else {
          // If no profile, they need to go to /setup (Step A2)
          setNeedsSetup(true)
        }
      } catch (error) {
        console.error('Admin integrity check failed:', error)
      } finally {
        setIsLinking(false)
      }
    }

    checkAdminRecord()
  }, [userId, isLoaded])

  return { isLinking, isLinked, needsSetup }
}
