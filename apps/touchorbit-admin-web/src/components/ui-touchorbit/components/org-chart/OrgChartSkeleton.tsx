'use client'

import React from 'react'

function SkeletonNode() {
  return (
    <div className="w-[260px] rounded-2xl border border-gray-100 bg-white/60 backdrop-blur-sm p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
      </div>
    </div>
  )
}

function SkeletonEdge() {
  return <div className="w-px h-8 bg-gray-200" />
}

export function OrgChartSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <SkeletonNode />
        <SkeletonEdge />
        <div className="flex gap-6">
          <div className="flex flex-col items-center gap-4">
            <SkeletonNode />
            <SkeletonEdge />
            <SkeletonNode />
          </div>
          <div className="flex flex-col items-center gap-4">
            <SkeletonNode />
            <SkeletonEdge />
            <SkeletonNode />
          </div>
        </div>
      </div>
    </div>
  )
}
