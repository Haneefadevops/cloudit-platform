'use client'

import { useState, useCallback, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { OrgChart, type MatrixEdge, type Vacancy } from '@/components/ui-touchorbit'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useAdminOrgChart } from '@/hooks/use-admin-org-chart'
import { useOrgChartAsOf } from '@/hooks/use-org-chart-as-of'
import { useMatrixEdges } from '@/hooks/use-matrix-edges'
import { useVacancies } from '@/hooks/use-vacancies'
import { usePresence } from '@/hooks/use-presence'
import { useReassignManager } from '@/hooks/use-reassign-manager'
import { supabase } from '@/lib/supabase'
import { BentoSidePanel } from './components/BentoSidePanel'
import { toast } from 'sonner'
import { Calendar, RotateCcw } from 'lucide-react'

export default function AdminOrgChartPage() {
  const { userId, role, organizationId } = useAuth()
  const { data: liveData, isLoading: liveLoading } = useAdminOrgChart()
  const { data: matrixEdges = [], refetch: refetchMatrixEdges } = useMatrixEdges()
  const { data: vacancies = [], refetch: refetchVacancies } = useVacancies()
  const { presence, isLoading: presenceLoading } = usePresence()
  const reassignManager = useReassignManager()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedVacancyId, setSelectedVacancyId] = useState<string | null>(null)
  const [asOfDate, setAsOfDate] = useState<string>('')

  const { can, loading: permissionLoading } = usePermissions([
    'employees.reassign_manager',
    'employees.update_employment',
  ])

  const canReassign = permissionLoading
    ? role === 'owner' || role === 'super_admin'
    : can('employees.reassign_manager') || can('employees.update_employment')

  const isHistorical = !!asOfDate
  const { data: historicalData, isLoading: historicalLoading } = useOrgChartAsOf(
    isHistorical ? asOfDate : null
  )

  const chartData = isHistorical ? historicalData : liveData
  const isLoading = isHistorical ? historicalLoading : liveLoading

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !chartData) return null
    return chartData.find((n) => n.employee_id === selectedNodeId) ?? null
  }, [selectedNodeId, chartData])

  const selectedVacancy = useMemo(() => {
    if (!selectedVacancyId) return null
    return vacancies.find((v) => v.id === selectedVacancyId) ?? null
  }, [selectedVacancyId, vacancies])

  const selectedPresence = useMemo(() => {
    if (!selectedNodeId || !presence) return undefined
    return presence.find((p) => p.employee_id === selectedNodeId)
  }, [selectedNodeId, presence])

  const handleNodeClick = useCallback((nodeId: string) => {
    if (nodeId.startsWith('vacancy-')) {
      setSelectedVacancyId(nodeId.slice('vacancy-'.length))
      setSelectedNodeId(null)
      return
    }

    setSelectedNodeId(nodeId)
    setSelectedVacancyId(null)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedVacancyId(null)
  }, [])

  const handleReassign = useCallback(
    (employeeId: string, newManagerId: string | null) => {
      if (!canReassign || isHistorical) return
      reassignManager.mutate({ employeeId, managerId: newManagerId })
    },
    [canReassign, isHistorical, reassignManager]
  )

  const handleAddMatrixReport = useCallback(
    async (employeeId: string, matrixManagerId: string, relationshipType: string) => {
      if (!organizationId || isHistorical) return

      const { error } = await supabase.from('employee_matrix_reports').insert({
        organization_id: organizationId,
        employee_id: employeeId,
        matrix_manager_id: matrixManagerId,
        relationship_type: relationshipType || 'project',
      })

      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        if (message.includes('cycle')) {
          toast.error('That matrix relationship would create a cycle.')
        } else if (message.includes('duplicate') || message.includes('unique')) {
          toast.error('That matrix relationship already exists.')
        } else {
          toast.error('Could not add matrix relationship.')
        }
        return
      }

      toast.success('Matrix relationship added')
      await refetchMatrixEdges()
    },
    [organizationId, isHistorical, refetchMatrixEdges]
  )

  const handleRemoveMatrixReport = useCallback(
    async (edge: MatrixEdge) => {
      if (isHistorical) return

      const { error } = await supabase
        .from('employee_matrix_reports')
        .delete()
        .eq('employee_id', edge.employee_id)
        .eq('matrix_manager_id', edge.matrix_manager_id)
        .eq('relationship_type', edge.relationship_type)

      if (error) {
        toast.error('Could not remove matrix relationship.')
        return
      }

      toast.success('Matrix relationship removed')
      await refetchMatrixEdges()
    },
    [isHistorical, refetchMatrixEdges]
  )

  const handleFillVacancy = useCallback(
    async (vacancy: Vacancy) => {
      await refetchVacancies()
      window.location.href = `/employees?positionId=${encodeURIComponent(vacancy.id)}`
    },
    [refetchVacancies]
  )

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Organization Chart</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isHistorical
                ? `Historical view — showing org structure as of ${new Date(asOfDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Live reporting structure with presence and roll-ups'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date picker */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
                  aria-label="View org chart as of date"
                />
              </div>
              {isHistorical && (
                <button
                  onClick={() => setAsOfDate('')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-medium hover:bg-[#423a9e] transition-colors"
                  title="Return to live view"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Live</span>
                </button>
              )}
            </div>

            {canReassign && !isHistorical && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                Drag to reassign
              </span>
            )}

            {!presenceLoading && presence.length > 0 && !isHistorical && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {presence.filter((p) => p.status === 'clocked_in').length} in
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {presence.filter((p) => p.status === 'on_leave').length} leave
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Historical banner */}
        {isHistorical && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 text-xs font-medium text-amber-800 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            You are viewing a historical snapshot. Presence, drag-to-reassign, and real-time data are disabled.
            {chartData && (
              <span className="ml-auto text-amber-600">
                {chartData.length} employees on this date
              </span>
            )}
          </div>
        )}

        <div className="flex-1 bg-gray-50/50 relative">
          <OrgChart
            data={chartData ?? []}
            viewerRole="admin"
            presence={isHistorical ? [] : presence}
            matrixEdges={isHistorical ? [] : matrixEdges}
            vacancies={isHistorical ? [] : vacancies}
            currentUserId={userId ?? undefined}
            isLoading={isLoading}
            onNodeClick={handleNodeClick}
            onReassign={canReassign && !isHistorical ? handleReassign : undefined}
            selectedNodeId={selectedNodeId}
            isHistorical={isHistorical}
            sidePanel={
              selectedNode || selectedVacancy ? (
                <BentoSidePanel
                  node={selectedNode}
                  vacancy={selectedVacancy}
                  presence={selectedPresence}
                  employees={chartData ?? []}
                  matrixEdges={matrixEdges}
                  isHistorical={isHistorical}
                  onAddMatrixReport={handleAddMatrixReport}
                  onRemoveMatrixReport={handleRemoveMatrixReport}
                  onFillVacancy={handleFillVacancy}
                  onClose={handleClosePanel}
                />
              ) : null
            }
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
