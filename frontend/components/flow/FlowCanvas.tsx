'use client'
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState, MarkerType, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'
import { FlowCell, FlowEdge } from '@/lib/api'
import Link from 'next/link'
import { useMemo, useEffect, useRef, useCallback } from 'react'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface Props { projectId: string; cells: FlowCell[]; edges: FlowEdge[]; adminMode?: boolean; token?: string }

function CellNode({ data }: any) {
  const done = !!data.cell.output_cache
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#D47E30', border: 'none', width: 8, height: 8 }} />
      <div className={`border-2 rounded-2xl p-5 w-[260px] shadow-sm transition-all duration-200 hover:shadow-md ${
        done ? 'bg-[#F0FDF4] border-[#22C55E]' : 'bg-[#FEFDF5] border-[#C4A882]'
      }`}>
        {/* Title — Oliver font */}
        <div style={{ fontFamily: 'Oliver, serif' }}
          className={`text-base mb-2 leading-tight lowercase ${done ? 'text-[#15803D]' : 'text-[#5C3D1E]'}`}>
          {data.label}
        </div>

        {/* Description */}
        {data.cell.description && (
          <p className="text-xs text-[#9A7355] leading-relaxed mb-4 line-clamp-4">
            {data.cell.description}
          </p>
        )}

        {/* Analysed badge */}
        {done && (
          <div className="flex items-center gap-1.5 text-xs text-[#16A34A] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            Analysed
          </div>
        )}

        {/* Converse button */}
        <Link
          href={`/projects/${data.projectId}/flow/${data.cell.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors duration-150"
          style={{ background: '#D47E30' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#B86820')}
          onMouseLeave={e => (e.currentTarget.style.background = '#D47E30')}
        >
          converse →
        </Link>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#D47E30', border: 'none', width: 8, height: 8 }} />
    </>
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
    style: { stroke: '#D47E30', strokeWidth: 1.5, strokeDasharray: '6 4' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#D47E30', width: 14, height: 14 },
  })), [edges])

  const [rNodes, setNodes, onNodesChange] = useNodesState(nodes)
  const [rEdges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync when server re-renders with updated data (e.g. after self-heal creates edges)
  useEffect(() => { setNodes(nodes) }, [nodes])    // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEdges(rfEdges) }, [rfEdges]) // eslint-disable-line react-hooks/exhaustive-deps

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
