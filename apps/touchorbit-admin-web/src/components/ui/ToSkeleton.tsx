'use client'

import React from 'react'

export function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-[#F1F0F4] ${className}`} />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#F1F0F4] p-5">
      <div className="flex items-start justify-between mb-3">
        <SkeletonPulse className="w-9 h-9 rounded-lg" />
        <SkeletonPulse className="w-12 h-5 rounded-full" />
      </div>
      <SkeletonPulse className="w-16 h-7 rounded-md mb-2" />
      <SkeletonPulse className="w-24 h-3 rounded-md" />
    </div>
  )
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-t border-[#F8F7F9]">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonPulse className={`h-4 rounded-md ${i === 0 ? 'w-32' : i === columns - 1 ? 'w-16 ml-auto' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  )
}
