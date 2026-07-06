import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isPlaceholder(u?: string): boolean {
  return !u || u.includes('placeholder.supabase.co')
}

function createStubClient(): any {
  const error = new Error(
    'Supabase service role key is not configured. Set SUPABASE_SERVICE_ROLE_KEY.'
  )

  const handler = {
    get() {
      return proxy
    },
    apply() {
      return proxy
    },
  }

  const proxy: any = new Proxy(() => proxy, handler)
  proxy.then = (_onFulfilled: any, onRejected: any) => {
    return Promise.reject(error).then(undefined, onRejected)
  }
  proxy.catch = (onRejected: any) => proxy.then(undefined, onRejected)
  proxy.finally = (onFinally: any) => proxy.then(undefined, undefined).finally(onFinally)
  return proxy
}

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = isPlaceholder(url)
      ? createStubClient()
      : createClient(url!, serviceKey!, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
  }
  return adminClient as SupabaseClient
}
