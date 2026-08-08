'use client';

import { useState } from 'react';
import BrowserFrame from '../../BrowserFrame';
import AssetsScreen from './screens/AssetsScreen';
import CustomersScreen from './screens/CustomersScreen';
import DashboardHome from './screens/DashboardHome';
import JobsScreen from './screens/JobsScreen';
import QuotationsScreen from './screens/QuotationsScreen';
import ReportsScreen from './screens/ReportsScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import TechniciansScreen from './screens/TechniciansScreen';

export type ScreenId =
  | 'dashboard'
  | 'jobs'
  | 'schedule'
  | 'customers'
  | 'assets'
  | 'quotations'
  | 'technicians'
  | 'reports';

const NAV: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'jobs', label: 'Jobs', icon: '☰' },
  { id: 'schedule', label: 'Schedule', icon: '▤' },
  { id: 'customers', label: 'Customers', icon: '◉' },
  { id: 'assets', label: 'Assets', icon: '⌗' },
  { id: 'quotations', label: 'Quotations', icon: '✎' },
  { id: 'technicians', label: 'Technicians', icon: '⚒' },
  { id: 'reports', label: 'Reports', icon: '↗' },
];

/**
 * Contractor Dashboard workspace — the full app.fixifai.com back-office
 * with sidebar nav and 8 switchable screens.
 */
export default function ContractorDashboard() {
  const [screen, setScreen] = useState<ScreenId>('dashboard');

  const navButton = (item: (typeof NAV)[number]) => (
    <button
      key={item.id}
      type="button"
      onClick={() => setScreen(item.id)}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
        screen === item.id
          ? 'bg-brand-teal text-white shadow-sm'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className="w-4 text-center text-[11px]">{item.icon}</span>
      {item.label}
    </button>
  );

  return (
    <BrowserFrame url="app.fixifai.com" caption="The contractor's back-office — everything on one screen">
      <div className="lg:flex lg:gap-4">
        {/* sidebar — desktop */}
        <aside className="hidden w-44 shrink-0 flex-col gap-1 rounded-xl bg-brand-dark p-3 lg:flex">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white font-heading text-[11px] font-bold text-brand-teal">
              F
            </span>
            <div>
              <p className="font-heading text-[11px] font-bold leading-tight text-white">FixifAI</p>
              <p className="text-[9px] leading-tight text-white/50">CityFix Maintenance</p>
            </div>
          </div>
          {NAV.map(navButton)}
          <div className="mt-auto rounded-lg bg-white/5 p-2.5">
            <p className="text-[9px] font-semibold text-white/50">Signed in as</p>
            <p className="truncate text-[10px] font-bold text-white">Nuwan — Ops Manager</p>
          </div>
        </aside>

        {/* top nav — mobile/tablet */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto rounded-xl bg-brand-dark p-2 lg:hidden">
          {NAV.map(navButton)}
        </div>

        {/* active screen */}
        <div className="min-w-0 flex-1">
          {screen === 'dashboard' && <DashboardHome />}
          {screen === 'jobs' && <JobsScreen />}
          {screen === 'schedule' && <ScheduleScreen />}
          {screen === 'customers' && <CustomersScreen />}
          {screen === 'assets' && <AssetsScreen />}
          {screen === 'quotations' && <QuotationsScreen />}
          {screen === 'technicians' && <TechniciansScreen />}
          {screen === 'reports' && <ReportsScreen />}
        </div>
      </div>
    </BrowserFrame>
  );
}
