import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'

type Tone = 'purple' | 'green' | 'amber' | 'red' | 'blue' | 'sky' | 'violet' | 'orange' | 'gray'

const toneClasses: Record<Tone, { chip: string; text: string; soft: string; dot: string }> = {
  purple: { chip: 'bg-[#F1EEFF] text-[#534AB7]', text: 'text-[#534AB7]', soft: 'bg-[#F8F6FF]', dot: 'bg-[#534AB7]' },
  green: { chip: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', soft: 'bg-emerald-50', dot: 'bg-emerald-500' },
  amber: { chip: 'bg-amber-50 text-amber-600', text: 'text-amber-600', soft: 'bg-amber-50', dot: 'bg-amber-500' },
  red: { chip: 'bg-red-50 text-red-600', text: 'text-red-600', soft: 'bg-red-50', dot: 'bg-red-500' },
  blue: { chip: 'bg-blue-50 text-blue-600', text: 'text-blue-600', soft: 'bg-blue-50', dot: 'bg-blue-500' },
  sky: { chip: 'bg-sky-50 text-sky-600', text: 'text-sky-600', soft: 'bg-sky-50', dot: 'bg-sky-500' },
  violet: { chip: 'bg-violet-50 text-violet-600', text: 'text-violet-600', soft: 'bg-violet-50', dot: 'bg-violet-500' },
  orange: { chip: 'bg-orange-50 text-orange-600', text: 'text-orange-600', soft: 'bg-orange-50', dot: 'bg-orange-500' },
  gray: { chip: 'bg-[#F8F7F9] text-[#9994A8]', text: 'text-[#9994A8]', soft: 'bg-[#F8F7F9]', dot: 'bg-[#C7C3D0]' },
}

export function WidgetIcon({ icon: Icon, tone = 'purple', size = 'md' }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14 rounded-full' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 15 : 19
  return (
    <div className={`${box} ${toneClasses[tone].chip} flex shrink-0 items-center justify-center`}>
      <Icon size={iconSize} strokeWidth={2.4} />
    </div>
  )
}

export function WidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="text-[12px] font-semibold text-[#9994A8]">Failed to load</p>
      <button onClick={onRetry} className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-black text-[#534AB7] hover:bg-[#F1EEFF]">
        Retry
      </button>
    </div>
  )
}

export function WidgetEmpty({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <WidgetIcon icon={icon} tone="gray" size="lg" />
      <p className="mt-3 text-[13px] font-semibold text-[#9994A8]">{label}</p>
    </div>
  )
}

export function MiniStat({ label, value, tone = 'purple' }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#F1F0F4] bg-white px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${toneClasses[tone].dot}`} />
        <span className="truncate text-[9px] font-black uppercase tracking-wide text-[#9994A8]">{label}</span>
      </div>
      <p className={`text-[15px] font-black leading-none ${toneClasses[tone].text}`}>{value}</p>
    </div>
  )
}

export function SoftBadge({ children, tone = 'purple' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`rounded-[8px] px-2.5 py-1 text-[10px] font-black ${toneClasses[tone].chip}`}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, tone = 'purple' }: { value: number; tone?: Tone }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F0F4]">
      <div className={`h-full rounded-full ${toneClasses[tone].dot} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function WidgetFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-auto border-t border-[#F1F0F4] px-4 py-3">
      <Link href={href} className="flex items-center justify-between text-[11px] font-black text-[#534AB7]">
        <span>{children}</span>
        <ArrowRight size={13} />
      </Link>
    </div>
  )
}

export function CompactMetricLink({
  href,
  tone,
  value,
  label,
  detail,
}: {
  href: string
  icon: LucideIcon
  tone: Tone
  value: string | number
  label: string
  detail: string
}) {
  return (
    <Link href={href} className="group flex h-full flex-col items-center justify-center p-4 text-center">
      <p className={`text-[46px] font-black leading-none ${toneClasses[tone].text}`}>{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
      <span className={`mt-6 rounded-xl border px-4 py-3 text-sm font-bold ${toneClasses[tone].chip}`}>
        {detail}
      </span>
    </Link>
  )
}
