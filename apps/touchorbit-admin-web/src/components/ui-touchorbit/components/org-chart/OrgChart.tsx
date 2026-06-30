'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, Crosshair, ArrowLeftRight, ArrowUpDown, Move, Printer, Image, Palette, GitBranch, Users } from 'lucide-react'
import { toPng } from 'html-to-image'

import type { OrgChartData, ViewerRole, PresenceInfo, MatrixEdge, Vacancy } from './types'
import { useOrgChartLayout, type LayoutDirection } from './use-layout'
import { OrgChartNode } from './OrgChartNode'
import { VacancyNode } from './VacancyNode'
import { OrgChartSkeleton } from './OrgChartSkeleton'

const VACANCY_NODE_WIDTH = 200
const VACANCY_NODE_HEIGHT = 110
const VACANCY_OFFSET_Y = 160

const nodeTypes = { orgChartNode: OrgChartNode, vacancyNode: VacancyNode }

export interface OrgChartProps {
  data: OrgChartData
  viewerRole: ViewerRole
  presence?: PresenceInfo[]
  currentUserId?: string
  focusNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onReassign?: (employeeId: string, newManagerId: string | null) => void
  isLoading?: boolean
  className?: string
  sidePanel?: React.ReactNode
  selectedNodeId?: string | null
  isHistorical?: boolean
  matrixEdges?: MatrixEdge[]
  vacancies?: Vacancy[]
}

function OrgChartInner({
  data,
  viewerRole,
  presence,
  currentUserId,
  focusNodeId,
  onNodeClick,
  onReassign,
  isLoading,
  className,
  sidePanel,
  selectedNodeId: controlledSelectedNodeId,
  isHistorical = false,
  matrixEdges,
  vacancies,
}: OrgChartProps) {
  const { fitView, setCenter } = useReactFlow()
  const flowRef = useRef<HTMLDivElement>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    for (const n of data) {
      if (n.has_children) ids.add(n.employee_id)
    }
    return ids
  })
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)

  // Sprint A features
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Sprint C features
  const [showMatrix, setShowMatrix] = useState(false)
  const [showVacancies, setShowVacancies] = useState(false)

  // Drag-to-reassign state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const selectedNodeId = controlledSelectedNodeId ?? internalSelectedId
  const isAdmin = viewerRole === 'admin'
  const canReassign = isAdmin && !!onReassign

  // Presence map for O(1) lookup
  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceInfo>()
    for (const p of presence ?? []) {
      map.set(p.employee_id, p)
    }
    return map
  }, [presence])

  // Build layout
  const { nodes: rawNodes, edges: baseEdges } = useOrgChartLayout(data, expandedIds, layoutDirection)

  // Compute vacancy positions
  const { vacancyNodes, vacancyEdges } = useMemo(() => {
    if (!showVacancies || !vacancies || vacancies.length === 0 || !isAdmin) {
      return { vacancyNodes: [] as Node[], vacancyEdges: [] as Edge[] }
    }

    const managerMap = new Map<string, Node>()
    for (const n of rawNodes) {
      managerMap.set(n.id, n)
    }

    const byManager = new Map<string, Vacancy[]>()
    for (const v of vacancies) {
      if (!v.manager_id) continue
      const list = byManager.get(v.manager_id) ?? []
      list.push(v)
      byManager.set(v.manager_id, list)
    }

    const vNodes: Node[] = []
    const vEdges: Edge[] = []

    for (const [managerId, list] of byManager) {
      const manager = managerMap.get(managerId)
      if (!manager) continue

      const startX = manager.position.x + 130 - ((list.length - 1) * (VACANCY_NODE_WIDTH + 20)) / 2
      const startY = manager.position.y + VACANCY_OFFSET_Y

      list.forEach((vacancy, idx) => {
        const x = startX + idx * (VACANCY_NODE_WIDTH + 20) - VACANCY_NODE_WIDTH / 2
        const y = startY - VACANCY_NODE_HEIGHT / 2

        vNodes.push({
          id: `vacancy-${vacancy.id}`,
          type: 'vacancyNode',
          position: { x, y },
          data: { vacancy },
          draggable: false,
          selectable: true,
        })

        vEdges.push({
          id: `vacancy-edge-${vacancy.id}`,
          source: managerId,
          target: `vacancy-${vacancy.id}`,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#D1D5DB', strokeWidth: 2, strokeDasharray: '4,4' },
        })
      })
    }

    return { vacancyNodes: vNodes, vacancyEdges: vEdges }
  }, [showVacancies, vacancies, isAdmin, rawNodes])

  // Compute matrix edges
  const matrixFlowEdges = useMemo(() => {
    if (!showMatrix || !matrixEdges || matrixEdges.length === 0 || !isAdmin) return []

    const visibleIds = new Set(rawNodes.map((n) => n.id))

    return matrixEdges
      .filter((me) => visibleIds.has(me.employee_id) && visibleIds.has(me.matrix_manager_id))
      .map((me) => ({
        id: `matrix-${me.employee_id}-${me.matrix_manager_id}`,
        source: me.matrix_manager_id,
        target: me.employee_id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5,5' },
      }))
  }, [showMatrix, matrixEdges, isAdmin, rawNodes])

  // Combine all nodes and edges
  const allNodes: Node[] = useMemo(() => {
    const nodes = rawNodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        transition: draggingId ? 'none' : undefined,
        opacity: draggingId && n.id === draggingId ? 0.7 : 1,
      },
      data: {
        ...n.data,
        viewerRole,
        onToggleExpand: (id: string) => {
          setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        },
        presence: presenceMap.get(n.id),
        isDropTarget: dropTargetId === n.id,
        heatmapEnabled,
        isHistorical,
      },
    }))
    return [...nodes, ...vacancyNodes]
  }, [rawNodes, vacancyNodes, viewerRole, draggingId, dropTargetId, presenceMap, heatmapEnabled, isHistorical])

  const allEdges: Edge[] = useMemo(() => {
    return [...baseEdges, ...vacancyEdges, ...matrixFlowEdges]
  }, [baseEdges, vacancyEdges, matrixFlowEdges])

  // Find nearest drop target during drag
  const findDropTarget = useCallback(
    (draggedId: string, position: { x: number; y: number }) => {
      const THRESHOLD = 140
      let bestId: string | null = null
      let bestDist = Infinity

      for (const n of rawNodes) {
        if (n.id === draggedId) continue
        const draggedNode = data.find((d) => d.employee_id === draggedId)
        if (draggedNode?.path_ids.includes(n.id)) continue

        const cx = n.position.x + 130
        const cy = n.position.y + 55
        const dx = position.x + 130 - cx
        const dy = position.y + 55 - cy
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < THRESHOLD && dist < bestDist) {
          bestDist = dist
          bestId = n.id
        }
      }
      return bestId
    },
    [rawNodes, data]
  )

  // Drag handlers
  const handleDragStart = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (!canReassign) return
      setDraggingId(node.id)
      setDropTargetId(null)
    },
    [canReassign]
  )

  const handleDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (!canReassign || !draggingId) return
      const target = findDropTarget(node.id, node.position)
      setDropTargetId(target)
    },
    [canReassign, draggingId, findDropTarget]
  )

  const handleDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (!canReassign || !draggingId) {
        setDraggingId(null)
        setDropTargetId(null)
        return
      }
      if (dropTargetId && dropTargetId !== draggingId) {
        onReassign?.(draggingId, dropTargetId)
      }
      setDraggingId(null)
      setDropTargetId(null)
    },
    [canReassign, draggingId, dropTargetId, onReassign]
  )

  // Export PNG
  const handleExportPng = useCallback(async () => {
    if (!flowRef.current) return
    setIsExporting(true)
    try {
      const flowElement = flowRef.current.querySelector('.react-flow__viewport') as HTMLElement
      if (!flowElement) throw new Error('Viewport not found')
      const dataUrl = await toPng(flowElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })
      const link = document.createElement('a')
      link.download = `org-chart-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  // Print
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Focus helper
  const zoomToNode = useCallback(
    (nodeId: string, expandPath = true) => {
      const target = data.find((n) => n.employee_id === nodeId)
      if (!target) return

      if (expandPath) {
        setExpandedIds((prev) => {
          const next = new Set(prev)
          for (const id of target.path_ids) {
            next.add(id)
          }
          return next
        })
      }

      setFocusedId(nodeId)
      onNodeClick?.(nodeId)

      requestAnimationFrame(() => {
        const flowNode = rawNodes.find((n) => n.id === nodeId)
        if (flowNode) {
          setCenter(flowNode.position.x + 130, flowNode.position.y + 55, {
            zoom: 1,
            duration: 400,
          })
        }
      })
    },
    [data, rawNodes, setCenter, onNodeClick]
  )

  // Self-focus on first mount
  useEffect(() => {
    if (!currentUserId) return
    const userNode = data.find((n) => n.employee_id === currentUserId)
    if (!userNode) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of userNode.path_ids) {
        next.add(id)
      }
      return next
    })
    setFocusedId(currentUserId)
    const t = setTimeout(() => {
      zoomToNode(currentUserId, false)
    }, 300)
    return () => clearTimeout(t)
  }, [currentUserId, data, zoomToNode])

  // External focusNodeId changes
  useEffect(() => {
    if (focusNodeId) {
      zoomToNode(focusNodeId)
    }
  }, [focusNodeId, zoomToNode])

  // Fit view on layout direction change
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100)
    return () => clearTimeout(t)
  }, [fitView, layoutDirection])

  // Fit view when toggling vacancies/matrix
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 150)
    return () => clearTimeout(t)
  }, [fitView, showVacancies, showMatrix])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return data.filter(
      (n) =>
        n.full_name.toLowerCase().includes(q) ||
        (n.job_title ?? '').toLowerCase().includes(q) ||
        (n.department_name ?? '').toLowerCase().includes(q)
    )
  }, [data, searchQuery])

  // Breadcrumb path for focused node
  const breadcrumbPath = useMemo(() => {
    if (!focusedId) return []
    const node = data.find((n) => n.employee_id === focusedId)
    if (!node) return []
    return node.path_ids
      .map((id) => data.find((n) => n.employee_id === id))
      .filter(Boolean)
  }, [focusedId, data])

  // Keyboard shortcut: Cmd+K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (isLoading) {
    return (
      <div className={`w-full h-full ${className ?? ''}`}>
        <OrgChartSkeleton />
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className ?? ''}`} ref={flowRef}>
      {/* Gradient mesh canvas background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, rgba(83,74,183,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(14,165,233,0.05) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(248,247,249,1) 0%, rgba(255,255,255,1) 100%)',
        }}
      />

      {/* Breadcrumb rail */}
      {breadcrumbPath.length > 0 && (
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-white/70 backdrop-blur-md rounded-full border border-gray-100 shadow-sm text-xs">
            {breadcrumbPath.map((node, idx) => (
              <span key={node!.employee_id} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <span className="text-gray-300 mx-0.5">/</span>}
                <button
                  onClick={() => zoomToNode(node!.employee_id, false)}
                  className={`hover:text-[#534AB7] transition-colors ${
                    node!.employee_id === focusedId ? 'font-semibold text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {node!.full_name}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Floating toolbar */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
        {/* Search */}
        <div className="relative">
          <button
            onClick={() => setSearchOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2.5 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 shadow-sm text-xs font-medium text-gray-600 hover:bg-white transition-colors"
            aria-label="Search people"
            title="Search (⌘K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-400">
              ⌘K
            </kbd>
          </button>

          {searchOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-72 bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchOpen(false)
                  }}
                  placeholder="Name, title, department…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  aria-label="Search people"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-400">
                    {searchQuery ? 'No results' : 'Type to search'}
                  </div>
                ) : (
                  searchResults.map((node) => (
                    <button
                      key={node.employee_id}
                      onClick={() => {
                        zoomToNode(node.employee_id)
                        setSearchOpen(false)
                        setSearchQuery('')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{
                          backgroundColor:
                            {
                              EXEC: '#534AB7',
                              ENG: '#0EA5E9',
                              FIN: '#10B981',
                              HR: '#F59E0B',
                              PROD: '#EC4899',
                            }[node.department_code ?? ''] ?? '#6B7280',
                        }}
                      >
                        {node.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-900 truncate">
                          {node.full_name}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {node.job_title}
                          {node.job_title && node.department_name ? ' · ' : ''}
                          {node.department_name}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Focus on me */}
        {currentUserId && (
          <button
            onClick={() => zoomToNode(currentUserId)}
            className="flex items-center gap-2 px-3 py-2.5 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 shadow-sm text-xs font-medium text-gray-600 hover:bg-white transition-colors"
            title="Focus on me"
            aria-label="Focus on my position"
          >
            <Crosshair className="w-4 h-4" />
            <span className="hidden sm:inline">Focus me</span>
          </button>
        )}

        {/* Layout toggle */}
        <button
          onClick={() => setLayoutDirection((d) => (d === 'TB' ? 'LR' : 'TB'))}
          className="flex items-center gap-2 px-3 py-2.5 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 shadow-sm text-xs font-medium text-gray-600 hover:bg-white transition-colors"
          title="Toggle layout"
          aria-label={`Switch to ${layoutDirection === 'TB' ? 'horizontal' : 'vertical'} layout`}
        >
          {layoutDirection === 'TB' ? (
            <ArrowUpDown className="w-4 h-4" />
          ) : (
            <ArrowLeftRight className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {layoutDirection === 'TB' ? 'Vertical' : 'Horizontal'}
          </span>
        </button>

        {/* Admin-only toolbar */}
        {isAdmin && (
          <>
            {/* Heatmap toggle */}
            <button
              onClick={() => setHeatmapEnabled((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border shadow-sm text-xs font-medium transition-colors ${
                heatmapEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white/80 backdrop-blur-md border-gray-200 text-gray-600 hover:bg-white'
              }`}
              title="Toggle span-of-control heatmap"
              aria-label="Toggle span-of-control heatmap"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Heatmap</span>
            </button>

            {/* Matrix toggle */}
            <button
              onClick={() => setShowMatrix((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border shadow-sm text-xs font-medium transition-colors ${
                showMatrix
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white/80 backdrop-blur-md border-gray-200 text-gray-600 hover:bg-white'
              }`}
              title="Toggle matrix reporting lines"
              aria-label="Toggle matrix reporting lines"
            >
              <GitBranch className="w-4 h-4" />
              <span className="hidden sm:inline">Matrix</span>
            </button>

            {/* Vacancies toggle */}
            <button
              onClick={() => setShowVacancies((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border shadow-sm text-xs font-medium transition-colors ${
                showVacancies
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white/80 backdrop-blur-md border-gray-200 text-gray-600 hover:bg-white'
              }`}
              title="Toggle vacancy nodes"
              aria-label="Toggle vacancy nodes"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Vacancies</span>
            </button>

            {/* Export PNG */}
            <button
              onClick={handleExportPng}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2.5 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 shadow-sm text-xs font-medium text-gray-600 hover:bg-white transition-colors disabled:opacity-50"
              title="Export as PNG"
              aria-label="Export org chart as PNG"
            >
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'PNG'}</span>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2.5 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 shadow-sm text-xs font-medium text-gray-600 hover:bg-white transition-colors"
              title="Print"
              aria-label="Print org chart"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </>
        )}
      </div>

      {/* Drag hint */}
      {canReassign && !draggingId && (
        <div className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-white/70 backdrop-blur-md rounded-full border border-gray-100 shadow-sm text-[10px] font-medium text-gray-500 flex items-center gap-1.5 print:hidden">
          <Move className="w-3 h-3" />
          Drag a card onto another to reassign
        </div>
      )}

      {/* Heatmap legend */}
      {isAdmin && heatmapEnabled && (
        <div className="absolute top-3 right-3 z-10 px-3 py-2 bg-white/80 backdrop-blur-md rounded-xl border border-gray-100 shadow-sm text-[10px] font-medium text-gray-500 space-y-1 print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
            <span>≤ 5 directs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-amber-500/20 border border-amber-500/30" />
            <span>6–9 directs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-red-500/20 border border-red-500/30" />
            <span>≥ 10 directs</span>
          </div>
        </div>
      )}

      {/* React Flow */}
      <ReactFlow
        nodes={allNodes}
        edges={allEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 300 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={viewerRole === 'admin'}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => {
          if (draggingId) return
          setInternalSelectedId(node.id)
          setFocusedId(node.id)
          onNodeClick?.(node.id)
        }}
        onNodeDragStart={handleDragStart}
        onNodeDrag={handleDrag}
        onNodeDragStop={handleDragStop}
      >
        <Background gap={16} size={1} color="#E5E7EB" />
        <Controls className="!bg-white/80 !backdrop-blur-md !border-gray-200 !shadow-sm" />
        <MiniMap
          className="!bg-white/80 !backdrop-blur-md !border-gray-200 !rounded-xl !shadow-sm"
          nodeColor={(n) => {
            if (n.type === 'vacancyNode') return '#9CA3AF'
            const code = (n.data?.node as any)?.department_code
            const palette: Record<string, string> = {
              EXEC: '#534AB7',
              ENG: '#0EA5E9',
              FIN: '#10B981',
              HR: '#F59E0B',
              PROD: '#EC4899',
            }
            return palette[code ?? ''] ?? '#9CA3AF'
          }}
          maskColor="rgba(0,0,0,0.05)"
          style={{ width: 140, height: 100 }}
        />
      </ReactFlow>

      {/* Side panel */}
      {sidePanel && (
        <div className="absolute top-0 right-0 bottom-0 z-20 w-full max-w-[420px]">
          {sidePanel}
        </div>
      )}
    </div>
  )
}

export function OrgChart(props: OrgChartProps) {
  return (
    <ReactFlowProvider>
      <OrgChartInner {...props} />
    </ReactFlowProvider>
  )
}
