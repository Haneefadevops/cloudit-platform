'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Video, Plug, Unplug, Loader2, Check, AlertTriangle, Eye, EyeOff, RefreshCw, ExternalLink } from 'lucide-react'

interface ProviderConfig {
  id: string
  provider: 'google_meet' | 'zoom' | 'microsoft_teams'
  auth_type: 'oauth' | 'api_key'
  is_active: boolean
  is_default: boolean
  connection_status: 'connected' | 'disconnected' | 'error'
  error_message?: string | null
  has_credentials: boolean
  created_at?: string
}

const PROVIDER_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  google_meet: { label: 'Google Meet', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'G' },
  zoom: { label: 'Zoom', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: 'Z' },
  microsoft_teams: { label: 'Microsoft Teams', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: 'T' },
}

export function MeetingProvidersSettings() {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  async function loadProviders() {
    setLoading(true)
    try {
      const res = await fetch('/api/meeting-providers')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setProviders(json.data || [])
    } catch {
      toast.error('Failed to load meeting providers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProviders()
  }, [])

  async function handleTest(providerId: string) {
    setTestingId(providerId)
    try {
      const res = await fetch(`/api/meeting-providers/${providerId}/test`, { method: 'POST' })
      if (!res.ok) throw new Error('Test failed')
      toast.success('Connection test successful')
      loadProviders()
    } catch {
      toast.error('Connection test failed')
    } finally {
      setTestingId(null)
    }
  }

  async function handleDisconnect(providerId: string) {
    try {
      const res = await fetch(`/api/meeting-providers/${providerId}/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Provider disconnected')
      loadProviders()
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  async function handleSaveApiKey(provider: string) {
    const key = apiKeys[provider]?.trim()
    if (!key) { toast.error('Enter an API key'); return }
    setSavingId(provider)
    try {
      const res = await fetch('/api/meeting-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, auth_type: 'api_key', credentials: { api_key: key }, is_active: true }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`${PROVIDER_META[provider]?.label || provider} connected`)
      setApiKeys(prev => ({ ...prev, [provider]: '' }))
      loadProviders()
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setSavingId(null)
    }
  }

  async function handleSetDefault(providerId: string) {
    try {
      const provider = providers.find(p => p.id === providerId)
      if (!provider) return
      const res = await fetch('/api/meeting-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, is_default: true, is_active: true }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Default provider updated')
      loadProviders()
    } catch {
      toast.error('Failed to update default')
    }
  }

  async function handleOAuthConnect(provider: string) {
    setOauthLoading(provider)
    try {
      const res = await fetch(`/api/meeting-providers/user/${provider}/connect`)
      if (!res.ok) throw new Error('Failed')
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        toast.error('OAuth not configured for this provider')
      }
    } catch {
      toast.error('Failed to start OAuth flow')
    } finally {
      setOauthLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#534AB7] mx-auto mb-3" />
        <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Loading Providers...</div>
      </div>
    )
  }

  const allProviders = ['google_meet', 'zoom', 'microsoft_teams']

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-black text-[#1A1727] flex items-center gap-2">
            <Video className="w-4 h-4 text-[#534AB7]" />
            Meeting Provider Integrations
          </h2>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Connect video conferencing platforms to auto-generate meeting links for calendar events.</p>
        </div>
        <button onClick={loadProviders} className="p-2 bg-white border border-[#F1F0F4] rounded-lg text-[#9CA3AF] hover:text-[#534AB7] transition-all">
          <RefreshCw size={14} />
        </button>
      </div>

      {allProviders.map(providerKey => {
        const meta = PROVIDER_META[providerKey]
        const connected = providers.find(p => p.provider === providerKey && p.connection_status === 'connected')
        const anyEntry = providers.find(p => p.provider === providerKey)
        const isDefault = connected?.is_default ?? false

        return (
          <div key={providerKey} className={`bg-white rounded-[20px] border p-5 shadow-sm ${connected ? meta.bg : 'border-[#F1F0F4]'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${meta.bg}`}>
                  {meta.icon}
                </div>
                <div>
                  <div className="text-sm font-black text-[#1A1727]">{meta.label}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {connected ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <Check size={10} strokeWidth={3} /> Connected
                      </span>
                    ) : anyEntry?.connection_status === 'error' ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-red-600 uppercase tracking-widest">
                        <AlertTriangle size={10} /> {anyEntry.error_message || 'Error'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Not connected</span>
                    )}
                    {isDefault && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[8px] font-black uppercase tracking-widest">Default</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connected && (
                  <>
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefault(connected.id)}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white border border-[#F1F0F4] text-[#534AB7] hover:bg-[#F8F7F9] transition-all"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleTest(connected.id)}
                      disabled={testingId === connected.id}
                      className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white border border-[#F1F0F4] text-[#374151] hover:bg-[#F8F7F9] transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      {testingId === connected.id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                      Test
                    </button>
                    <button
                      onClick={() => handleDisconnect(connected.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white border border-red-100 text-red-600 hover:bg-red-50 transition-all flex items-center gap-1"
                    >
                      <Unplug size={10} /> Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>

            {!connected && (
              <div className="space-y-3">
                {/* API Key input */}
                <div className="p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">API Key Connection</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey[providerKey] ? 'text' : 'password'}
                        value={apiKeys[providerKey] || ''}
                        onChange={e => setApiKeys(prev => ({ ...prev, [providerKey]: e.target.value }))}
                        placeholder={`Paste ${meta.label} API key...`}
                        className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none pr-9"
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [providerKey]: !prev[providerKey] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#534AB7]"
                      >
                        {showKey[providerKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveApiKey(providerKey)}
                      disabled={savingId === providerKey}
                      className="px-3 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingId === providerKey ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                      Connect
                    </button>
                  </div>
                </div>

                {/* OAuth connect */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#F1F0F4]" />
                  <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">or</span>
                  <div className="h-px flex-1 bg-[#F1F0F4]" />
                </div>

                <button
                  onClick={() => handleOAuthConnect(providerKey)}
                  disabled={oauthLoading === providerKey}
                  className="w-full py-2.5 bg-white border border-[#F1F0F4] rounded-xl text-[11px] font-black uppercase tracking-widest text-[#374151] hover:bg-[#F8F7F9] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {oauthLoading === providerKey ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                  Connect {meta.label} Account (OAuth)
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
