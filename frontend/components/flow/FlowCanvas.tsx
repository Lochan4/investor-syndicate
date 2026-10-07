'use client'
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import { FlowCell, FlowEdge } from '@/lib/api'
import Link from 'next/link'
import { useMemo, useEffect, useRef } from 'react'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface Props { projectId: string; cells: FlowCell[]; edges: FlowEdge[]; adminMode?: boolean; token?: string }

function CellNode({ data }: any) {
  return (
    <Link href={`/projects/${data.projectId}/flow/${data.cell.id}`}>
      <div className="bg-[#FDFBD4] border-2 border-[#8D5A2B] rounded-xl px-5 py-4 min-w-[220px] max-w-[280px] text-center cursor-pointer hover:border-[#D47E30] hover:shadow-md transition-all duration-200">
        <div className="text-sm font-semibold text-[#825E34] leading-snug">{data.label}</div>
        {data.cell.output_cache && <div className="text-xs text-[#D47E30] mt-1.5">● Analysed</div>}
      </div>
    </Link>
  )
}

const nodeTypes = { cellNode: CellNode }

/** Returns true if any two nodes are within 350px of each other (positions too close). */
function tooClose(cells: FlowCell[]): boolean {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const dx = cells[i].position_x - cells[j].position_x
      const dy = cells[i].position_y - cells[j].position_y
      if (Math.sqrt(dx * dx + dy * dy) < 350) return true
    }
  }
  return false
}

export function FlowCanvas({ projectId, cells, edges, adminMode, token }: Props) {
  const relayoutDone = useRef(false)

  // Auto-relayout once if cells are too close — silently fixes bad stored positions
  useEffect(() => {
    if (!token || relayoutDone.current || cells.length < 2) return
    if (!tooClose(cells)) return
    relayoutDone.current = true
    fetch(`${BASE}/projects/${projectId}/flow/relayout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => window.location.reload()).catch(() => {})
  }, [cells, projectId, token])

  const nodes: Node[] = useMemo(() => cells.map(c => ({
    id: c.id,
    position: { x: c.position_x, y: c.position_y },
    data: { label: c.topic, cell: c, projectId },
    type: 'cellNode',
  })), [cells, projectId])

  const rfEdges: Edge[] = useMemo(() => edges.map(e => ({
    id: e.id, source: e.from_cell, target: e.to_cell,
    style: { stroke: '#D47E30', strokeWidth: 2 },
  })), [edges])

  const [rNodes, , onNodesChange] = useNodesState(nodes)
  const [rEdges, , onEdgesChange] = useEdgesState(rfEdges)

  return (
    <div style={{ height: '100%', background: '#FCFAF4' }}>
      <ReactFlow
        nodes={rNodes} edges={rEdges}
        onNodesChange={adminMode ? onNodesChange : undefined}
        onEdgesChange={adminMode ? onEdgesChange : undefined}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.4, maxZoom: 1.5 }}
        minZoom={0.2}
        nodesDraggable={adminMode}
        nodesConnectable={adminMode}
      >
        <Background color="#8D5A2B" gap={24} size={1} style={{ opacity: 0.15 }} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
