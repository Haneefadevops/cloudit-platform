'use client'

import { Search, User as UserIcon, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { NotificationBell } from './notification-bell'

export function Header() {
  const { userProfile, signOut } = useAuth()

  return (
    <>
      {/* Search */}
      <div className="flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search employees..."
            className="w-full max-w-md rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700">
            <UserIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{userProfile?.first_name || 'User'}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-purple-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}
