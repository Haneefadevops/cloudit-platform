import { useMemo } from 'react'
import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { OrgChartData, OrgChartFlowNodeData } from './types'

const NODE_WIDTH = 260
const NODE_HEIGHT = 110
const RANK_SEP = 60
const NODE_SEP = 30

export type LayoutDirection = 'TB' | 'LR'

function buildVisibleData(
  data: OrgChartData,
  expandedIds: Set<string>
): OrgChartData {
  const visible = new Set<string>()

  for (const node of data) {
    visible.add(node.employee_id)
  }

  // Hide children of collapsed nodes
  for (const node of data) {
    if (node.manager_id && !expandedIds.has(node.manager_id)) {
      visible.delete(node.employee_id)
    }
  }

  return data.filter((n) => visible.has(n.employee_id))
}

export function useOrgChartLayout(
  data: OrgChartData,
  expandedIds: Set<string>,
  direction: LayoutDirection = 'TB'
): { nodes: Node<OrgChartFlowNodeData>[]; edges: Edge[] } {
  return useMemo(() => {
    const visible = buildVisibleData(data, expandedIds)

    const g = new dagre.graphlib.Graph()
    g.setGraph({
      rankdir: direction,
      ranksep: direction === 'LR' ? RANK_SEP * 1.2 : RANK_SEP,
      nodesep: NODE_SEP,
    })
    g.setDefaultEdgeLabel(() => ({}))

    for (const node of visible) {
      g.setNode(node.employee_id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }

    for (const node of visible) {
      if (node.manager_id) {
        g.setEdge(node.manager_id, node.employee_id)
      }
    }

    dagre.layout(g)

    const nodes: Node<OrgChartFlowNodeData>[] = visible.map((node) => {
      const dagreNode = g.node(node.employee_id)
      return {
        id: node.employee_id,
        type: 'orgChartNode',
        position: {
          x: dagreNode.x - NODE_WIDTH / 2,
          y: dagreNode.y - NODE_HEIGHT / 2,
        },
        data: {
          node,
          viewerRole: 'employee',
          isExpanded: expandedIds.has(node.employee_id),
        },
      }
    })

    const edges: Edge[] = visible
      .filter((node) => node.manager_id)
      .map((node) => ({
        id: `${node.manager_id}-${node.employee_id}`,
        source: node.manager_id!,
        target: node.employee_id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#D1D5DB', strokeWidth: 2 },
      }))

    return { nodes, edges }
  }, [data, expandedIds, direction])
}
