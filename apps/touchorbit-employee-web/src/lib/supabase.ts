import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function isPlaceholder(u?: string): boolean {
  return !u || u.includes('placeholder.supabase.co')
}

function createStubClient(): any {
  const error = new Error(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
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

export const supabase = isPlaceholder(url) ? createStubClient() : createBrowserClient(url!, key!)
