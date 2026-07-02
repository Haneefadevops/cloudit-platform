import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function useAutoLinkEmployee() {
  const { userId, isLoaded, user } = useAuth()
  const [isLinking, setIsLinking] = useState(false)
  const [isLinked, setIsLinked] = useState(false)

  useEffect(() => {
    async function checkEmployeeIntegrity() {
      if (!isLoaded || !userId) return
      if (isLinking || isLinked) return

      setIsLinking(true)

      try {
        // 1. Verify user profile exists
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single()

        if (!userRecord) {
          setIsLinked(false)
          return
        }

        // 2. Verify employee link exists (should be handled by provisioning)
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', userId)
          .single()

        setIsLinked(!!employee)
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
