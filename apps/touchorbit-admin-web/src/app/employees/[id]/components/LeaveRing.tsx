'use client'

interface LeaveRingProps {
  label: string
  remaining: number
  total: number
  color?: string
}

const TYPE_COLORS: Record<string, string> = {
  annual: '#534AB7',
  casual: '#2563EB',
  sick: '#F59E0B',
  maternity: '#EC4899',
  paternity: '#0891B2',
  unpaid: '#6B7280',
}

export function LeaveRing({ label, remaining, total, color }: LeaveRingProps) {
  const radius = 36
  const stroke = 6
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const percent = total > 0 ? remaining / total : 0
  const strokeDashoffset = circumference - percent * circumference
  const ringColor = color || TYPE_COLORS[label.toLowerCase().replace(' ', '_')] || '#534AB7'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={radius * 2} height={radius * 2} className="-rotate-90">
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="transparent"
            stroke="#F1F0F4"
            strokeWidth={stroke}
          />
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="transparent"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-black text-[#1A1727]">{remaining}</span>
          <span className="text-[9px] font-bold text-[#9994A8]">/ {total}</span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-[#6B6578]">{label}</span>
    </div>
  )
}
