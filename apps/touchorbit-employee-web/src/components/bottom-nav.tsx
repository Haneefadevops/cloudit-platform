'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, Umbrella, Calendar, Receipt, User, CalendarDays, GitBranch } from 'lucide-react'

const tabs = [
  { href: '/',           icon: Home,         label: 'Home' },
  { href: '/org-chart',  icon: GitBranch,      label: 'Org' },
  { href: '/attendance', icon: Clock,        label: 'Attendance' },
  { href: '/leave',      icon: Umbrella,     label: 'Leave' },
  { href: '/roster',     icon: CalendarDays, label: 'Schedule' },
  { href: '/calendar',   icon: Calendar,     label: 'Calendar' },
  { href: '/expenses',   icon: Receipt,      label: 'Expenses' },
  { href: '/profile',    icon: User,         label: 'Profile' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 safe-area-pb"
      style={{ borderTopColor: '#F1F0F4' }}
    >
      <div className="flex items-center justify-around h-16 pb-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center pt-2 gap-1 transition-all active:scale-90"
            >
              <Icon 
                size={19} 
                strokeWidth={isActive ? 2.2 : 1.6}
                style={{ color: isActive ? '#534AB7' : '#D1D5DB' }} 
              />
              <span 
                style={{ 
                  fontSize: '9.5px', 
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#534AB7' : '#9CA3AF'
                }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
