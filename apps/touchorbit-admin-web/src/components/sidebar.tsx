'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  CalendarClock,
  CalendarDays,
  MapPin,
  Megaphone,
  FileSignature,
  Settings,
  FileText,
  Timer,
  Edit,
  DollarSign,
  Gift,
  Wallet,
  Package,
  Star,
  GraduationCap,
  ShieldAlert,
  Inbox,
  AlertTriangle,
  GitBranch,
  ScrollText
} from 'lucide-react'

// Nav groups with section labels
const navGroups = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard',        href: '/',             icon: LayoutDashboard,  roles: ['owner','manager','hr_admin','finance','dept_manager','branch_manager'] },
      { name: 'Live Attendance',  href: '/attendance',   icon: Clock,            roles: ['owner','manager','hr_admin','dept_manager','branch_manager'], permission: 'attendance.read' },
      { name: 'Spoofing Review',  href: '/spoofing-review', icon: ShieldAlert,      roles: ['owner','hr_admin'], permission: 'attendance.review_spoofing' },
      { name: 'Employees',        href: '/employees',    icon: Users,            roles: ['owner','manager','hr_admin','dept_manager','branch_manager'], permission: 'employees.read' },
      { name: 'Org Chart',        href: '/employees/org-chart', icon: GitBranch,       roles: ['owner','manager','hr_admin','dept_manager','branch_manager'], permission: 'employees.read' },
    ]
  },
  {
    label: 'People',
    items: [
      { name: 'Leave Management', href: '/leave',        icon: Calendar,         roles: ['owner','manager','hr_admin','dept_manager','branch_manager'], permission: 'leave.read' },
      { name: 'Comp-Off',         href: '/comp-off',     icon: Gift,             roles: ['owner','manager','hr_admin'] },
      { name: 'Encashment',       href: '/encashment',   icon: DollarSign,       roles: ['owner','manager','hr_admin'] },
      { name: 'Overtime',         href: '/overtime',     icon: Timer,            roles: ['owner','manager','hr_admin','dept_manager','branch_manager'], permission: 'overtime.read' },
      { name: 'Roster',           href: '/roster',       icon: CalendarDays,     roles: ['owner','manager','hr_admin','dept_manager','branch_manager'] },
      { name: 'Corrections',      href: '/corrections',  icon: Edit,             roles: ['owner','manager','hr_admin','dept_manager','branch_manager'] },
      { name: 'Training',         href: '/training',     icon: GraduationCap,    roles: ['owner','manager','hr_admin'] },
      { name: 'Performance',      href: '/performance',  icon: Star,             roles: ['owner','manager','hr_admin'] },
      { name: 'Calendar',         href: '/calendar',     icon: CalendarDays,     roles: ['owner','manager','hr_admin'] },
      { name: 'Shifts',           href: '/shifts',       icon: CalendarClock,    roles: ['owner','manager','hr_admin'] },
    ]
  },
  {
    label: 'Finance',
    items: [
      { name: 'Payroll',          href: '/payroll',      icon: DollarSign,       roles: ['owner','manager','hr_admin','finance'], permission: 'payroll.read' },
      { name: 'Expenses',         href: '/expenses',     icon: Wallet,           roles: ['owner','manager','hr_admin','finance','dept_manager','branch_manager'], permission: 'expenses.read' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { name: 'Assets',           href: '/assets',       icon: Package,          roles: ['owner','manager','hr_admin'] },
      { name: 'Documents',        href: '/documents',    icon: FileSignature,    roles: ['owner','manager','hr_admin'] },
      { name: 'Announcements',    href: '/announcements',icon: Megaphone,        roles: ['owner','manager','hr_admin'] },
      { name: 'Geofences',        href: '/geofences',    icon: MapPin,           roles: ['owner','manager','hr_admin'], permission: 'geofences.manage' },
    ]
  },
  {
    label: 'System',
    items: [
      { name: 'Reports',          href: '/reports',      icon: FileText,         roles: ['owner','manager','hr_admin','finance'] },
      { name: 'Audit',            href: '/audit',        icon: ScrollText,       roles: ['owner','super_admin','hr_admin'], permission: 'audit.read' },
      { name: 'Settings',         href: '/settings',     icon: Settings,         roles: ['owner'], permission: 'settings.manage_roles' },
    ]
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed = false, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, userProfile, organizationId, userRole } = useAuth()
  const sidebarPermissions = navGroups.flatMap((group) => group.items.map((item) => item.permission).filter(Boolean)) as string[]
  const { can, loading: permissionsLoading } = usePermissions(sidebarPermissions)
  const [orgName, setOrgName] = useState('Loading...')
  const [suspiciousCount, setSuspiciousCount] = useState(0)

  useEffect(() => {
    async function loadData() {
      if (!organizationId) return

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()
      if (org) setOrgName(org.name)

      refreshSuspiciousCount()
    }

    async function refreshSuspiciousCount() {
      if (!organizationId) return
      const result = await api.get<any[]>('/attendance?limit=500')
      if (result.ok) {
        const count = (result.data || []).filter((e: any) => e.admin_review_status === 'flagged').length
        setSuspiciousCount(count)
      }
    }

    loadData()

    // TODO: re-introduce live suspicious count updates once backend exposes WebSocket/SSE
  }, [organizationId])

  const userInitials = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name[0]}${userProfile.last_name[0]}`
    : user?.email?.[0]?.toUpperCase() || 'U'

  const userName = userProfile?.first_name && userProfile?.last_name
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : user?.email || 'User'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(167,139,250,0.2)' }}>
          <span className="text-purple-400 font-black text-sm">T</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-[13px] leading-tight">TouchOrbit</p>
            <p className="text-[11px] leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>HR &amp; Attendance</p>
          </div>
        )}
        {onToggle && (
          <button onClick={onToggle} className="ml-auto text-white/40 hover:text-white transition-colors lg:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => {
            const legacyVisible = item.roles.includes(userRole ?? '')
            if (!item.permission) return legacyVisible
            return permissionsLoading ? legacyVisible : can(item.permission)
          })
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className="mb-2">
              {!collapsed && (
                <p className="px-3 mb-1 mt-4 first:mt-1 uppercase tracking-widest text-[9.5px] font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {group.label}
                </p>
              )}
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                const isSpoofing = item.name === 'Spoofing Review'

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between rounded-lg mb-0.5 transition-all duration-150 group ${collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2'}`}
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                      borderLeft: collapsed ? 'none' : isActive ? '3px solid rgba(167,139,250,0.8)' : '3px solid transparent',
                    }}
                    title={collapsed ? item.name : undefined}
                  >
                    <div className={`flex items-center min-w-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                      <item.icon
                        className="flex-shrink-0 transition-colors"
                        size={collapsed ? 18 : 15}
                        style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.45)' }}
                      />
                      {!collapsed && (
                        <span
                          className="text-[13px] truncate transition-colors"
                          style={{
                            color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {item.name}
                        </span>
                      )}
                    </div>
                    {isSpoofing && suspiciousCount > 0 && !collapsed && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white flex-shrink-0">
                        {suspiciousCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User info at bottom */}
      <div className={`px-4 py-4 border-t border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(167,139,250,0.2)' }}>
            <span className="text-purple-300 font-bold text-sm">{userInitials}</span>
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-white text-[13px] font-semibold truncate">{userName}</p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{orgName}</p>
              </div>
              {userRole && (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
                  {userRole.replace('_', ' ')}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className={`hidden lg:flex h-full flex-col transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[220px]'}`} style={{ backgroundColor: '#1E1854' }}>
        {sidebarContent}
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <div className="relative flex h-full w-[260px] flex-col" style={{ backgroundColor: '#1E1854' }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
