'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Briefcase } from 'lucide-react'
import type { VacancyFlowNodeData } from './types'

export const VacancyNode = memo(function VacancyNode(props: NodeProps) {
  const data = (props.data as unknown) as VacancyFlowNodeData
  const { vacancy } = data

  return (
    <div
      className="relative w-[200px] rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 backdrop-blur-sm p-4 opacity-80"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 bg-gray-100 border border-dashed border-gray-300">
          <Briefcase className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-600 truncate">
            {vacancy.title ?? 'Open Position'}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {vacancy.level ?? '—'}
          </div>
          {vacancy.department_name && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {vacancy.department_name}
            </div>
          )}
          <div className="mt-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">
            Open Role
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-300" aria-hidden="true" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-300" aria-hidden="true" />
    </div>
  )
})
