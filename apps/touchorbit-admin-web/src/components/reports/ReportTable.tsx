'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ToBadge } from '@/components/ui/ToBadge'

export type ColumnType = 'text' | 'number' | 'status' | 'date'

interface Column {
  key: string
  header: string
  type: ColumnType
  width?: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
}

interface SummaryCell {
  value: string | number
  colSpan?: number
  align?: 'left' | 'right' | 'center'
}

interface ReportTableProps {
  columns: Column[]
  rows: Record<string, unknown>[]
  summary?: SummaryCell[]
  onRowClick?: (row: Record<string, unknown>) => void
  loading?: boolean
}

type SortDir = 'asc' | 'desc'

export function ReportTable({
  columns,
  rows,
  summary,
  onRowClick,
  loading = false,
}: ReportTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av ?? '').toLowerCase()
      const bs = String(bv ?? '').toLowerCase()
      if (as < bs) return sortDir === 'asc' ? -1 : 1
      if (as > bs) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  const alignClass = (align?: string) => {
    switch (align) {
      case 'right': return 'text-right'
      case 'center': return 'text-center'
      default: return 'text-left'
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E3EA] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white/80 backdrop-blur-md">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`
                    whitespace-nowrap border-b border-[#E5E3EA] px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#9994A8]
                    ${col.sortable !== false ? 'cursor-pointer select-none hover:text-[#534AB7]' : ''}
                    ${alignClass(col.align)}
                  `}
                  style={{ width: col.width }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 6 }).map((_, ri) => (
                <tr key={ri} className="border-t border-[#F8F7F9]">
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-4 py-3">
                      <div className={`h-4 animate-pulse rounded-md bg-[#F1F0F4] ${ci === 0 ? 'w-32' : ci === columns.length - 1 ? 'w-16 ml-auto' : 'w-20'}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <p className="text-[13px] font-semibold text-[#9994A8]">No data available</p>
                </td>
              </tr>
            ) : (
              sortedRows.map((row, ri) => (
                <tr
                  key={ri}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    border-t border-[#F8F7F9] transition-colors
                    ${onRowClick ? 'cursor-pointer hover:bg-[#F8F7F9]' : 'hover:bg-[#FAFAFA]'}
                  `}
                >
                  {columns.map((col) => {
                    const val = row[col.key]
                    return (
                      <td
                        key={col.key}
                        className={`
                          whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-[#2A2537]
                          ${col.type === 'number' ? 'font-mono tabular-nums text-right' : ''}
                          ${alignClass(col.align)}
                        `}
                      >
                        {col.type === 'status' && typeof val === 'string' ? (
                          <ToBadge status={val} />
                        ) : (
                          String(val ?? '—')
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}

            {/* Summary footer */}
            {summary && summary.length > 0 && !loading && (
              <tr className="border-t-2 border-[#E5E3EA] bg-[#F8F7F9]">
                {summary.map((cell, si) => (
                  <td
                    key={si}
                    colSpan={cell.colSpan || 1}
                    className={`
                      whitespace-nowrap px-4 py-3 text-[12px] font-black text-[#2A2537]
                      ${alignClass(cell.align)}
                    `}
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
