'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import {
  Users,
  Timer,
  Calendar,
  Clock,
  DollarSign,
  Wallet,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

export default function ReportsPage() {
  const { isLoaded, isSignedIn, isOwner, isManager, isHrAdmin } = useAuth()
  const canAccess = isOwner || isManager || isHrAdmin

  if (!isLoaded) return null

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full bg-[#F8F7F9] items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <TrendingUp size={24} className="text-red-500" />
          </div>
          <p className="text-[16px] font-semibold text-[#1A1727]">Access Denied</p>
          <p className="text-[13px] text-[#9994A8]">You don&apos;t have permission to view reports.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[22px] font-bold text-[#1A1727]">Reports</h1>
          <p className="text-[13px] mt-0.5 text-[#9994A8]">Generate and export HR analytics</p>
        </div>

        {/* Bento Grid — Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Large Attendance Card */}
          <Link
            href="/reports/attendance"
            className="group relative overflow-hidden rounded-2xl border border-[#E5E3EA] bg-gradient-to-br from-[#F8F6FF] to-white p-6 transition-all hover:shadow-lg md:col-span-2 md:row-span-2 flex flex-col"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EEFF] text-[#534AB7]">
              <Users size={22} strokeWidth={2.2} />
            </div>
            <h2 className="text-lg font-black text-[#2A2537]">Attendance Report</h2>
            <p className="mt-1 text-[13px] font-medium text-[#9994A8] leading-relaxed max-w-[80%]">
              Clock-in rates, adherence trends, and absent patterns by employee and department
            </p>
            <div className="mt-auto pt-6">
              <p className="text-[40px] font-black leading-none text-[#534AB7]">89.4%</p>
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-[#9994A8]">
                Attendance this month
              </p>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#534AB7] px-4 py-2 text-[12px] font-black text-white shadow-sm w-fit transition-transform group-hover:translate-x-1">
              Generate <ArrowRight size={14} />
            </div>
          </Link>

          {/* OT Hours Stat Tile */}
          <div className="rounded-2xl border border-[#E5E3EA] bg-white p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Timer size={18} strokeWidth={2.2} />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                <TrendingUp size={12} /> ▲ 12%
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[28px] font-black leading-none text-[#2A2537]">42h</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#9994A8]">
                OT Hours
              </p>
            </div>
          </div>

          {/* Leave Days Stat Tile */}
          <div className="rounded-2xl border border-[#E5E3EA] bg-white p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Calendar size={18} strokeWidth={2.2} />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-500">
                <TrendingDown size={12} /> ▼ 5%
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[28px] font-black leading-none text-[#2A2537]">18</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#9994A8]">
                Leave Days
              </p>
            </div>
          </div>

          {/* Late Arrivals Card */}
          <Link
            href="/reports/late"
            className="group rounded-2xl border border-[#E5E3EA] bg-white p-5 transition-all hover:shadow-md md:col-span-2 flex flex-col"
          >
            <div className="flex items-start justify-between">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Clock size={18} strokeWidth={2.2} />
              </div>
              <ArrowRight size={16} className="text-[#D0CDD8] transition-colors group-hover:text-[#534AB7]" />
            </div>
            <div className="mt-auto pt-4">
              <p className="text-[28px] font-black leading-none text-[#2A2537]">38</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#9994A8]">
                Late Arrivals this month
              </p>
            </div>
          </Link>
        </div>

        {/* Bottom Row — 5 Report Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              title: 'Leave',
              desc: 'Usage by type and employee',
              href: '/reports/leave',
              icon: Calendar,
              tone: 'text-blue-600 bg-blue-50',
            },
            {
              title: 'Adherence',
              desc: 'Roster compliance rates',
              href: '/reports/roster',
              icon: CheckCircle,
              tone: 'text-emerald-600 bg-emerald-50',
            },
            {
              title: 'Overtime',
              desc: 'Hours and unscheduled OT',
              href: '/reports/overtime',
              icon: Timer,
              tone: 'text-amber-600 bg-amber-50',
            },
            {
              title: 'Payroll',
              desc: 'Gross, deductions & net pay',
              href: '/reports/payroll',
              icon: DollarSign,
              tone: 'text-[#534AB7] bg-[#F1EEFF]',
            },
            {
              title: 'Expense',
              desc: 'Claims by category & status',
              href: '/reports/expense',
              icon: Wallet,
              tone: 'text-violet-600 bg-violet-50',
            },
          ].map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group flex flex-col rounded-2xl border border-[#E5E3EA] bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                  <card.icon size={18} strokeWidth={2.2} />
                </div>
                <ArrowRight size={16} className="text-[#D0CDD8] transition-colors group-hover:text-[#534AB7]" />
              </div>
              <div className="mt-auto pt-4">
                <h3 className="text-[14px] font-bold text-[#2A2537]">{card.title}</h3>
                <p className="mt-0.5 text-[11px] font-medium text-[#9994A8] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
