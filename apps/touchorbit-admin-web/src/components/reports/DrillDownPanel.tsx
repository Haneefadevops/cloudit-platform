'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface DrillDownColumn {
  key: string
  header: string
  width?: string
}

interface DrillDownPanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  columns: DrillDownColumn[]
  rows: Record<string, unknown>[]
}

export function DrillDownPanel({
  open,
  onClose,
  title,
  subtitle,
  columns,
  rows,
}: DrillDownPanelProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity
          ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}
        `}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={`
          fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out
          sm:w-[480px]
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E3EA] px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-[#2A2537]">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[#9994A8]">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9994A8] transition-colors hover:bg-[#F8F7F9] hover:text-[#2A2537]"
            aria-label="Close panel"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] font-semibold text-[#9994A8]">No detail records found</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E5E3EA]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-md">
                  <tr className="border-b border-[#E5E3EA]">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.1em] text-[#9994A8]"
                        style={{ width: col.width }}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-t border-[#F8F7F9] transition-colors hover:bg-[#FAFAFA]"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold text-[#2A2537]"
                        >
                          {String(row[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
