'use client'
import { useEffect, useMemo, useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls,
  useNodesState, useEdgesState,
  BackgroundVariant, Node, Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { GraphData } from '@/lib/api'

const KIND_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  pdf:         { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  audio:       { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  image:       { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  spreadsheet: { bg: '#F5F3FF', border: '#8B5CF6', text: '#6D28D9' },
}
const DEFAULT_KIND = { bg: '#F8FAFC', border: '#94A3B8', text: '#475569' }

function computeLayout(nodes: GraphData['nodes']) {
  const groups: Record<string, GraphData['nodes']> = {}
  for (const n of nodes) {
    if (!groups[n.asset_id]) groups[n.asset_id] = []
    groups[n.asset_id].push(n)
  }
  const assetIds = Object.keys(groups)
  const bigR = Math.max(320, assetIds.length * 140)
  const positions: Record<string, { x: number; y: number }> = {}
  assetIds.forEach((assetId, ai) => {
    const angle = (2 * Math.PI * ai) / assetIds.length - Math.PI / 2
    const cx = bigR * Math.cos(angle)
    const cy = bigR * Math.sin(angle)
    const chunks = groups[assetId]
    const smallR = Math.max(70, chunks.length * 22)
    chunks.forEach((chunk, ci) => {
      const ca = (2 * Math.PI * ci) / chunks.length
      positions[chunk.id] = { x: cx + smallR * Math.cos(ca), y: cy + smallR * Math.sin(ca) }
    })
  })
  return positions
}

function buildRfNodes(
  dataNodes: GraphData['nodes'],
  highlightIds?: Set<string>,
  newIds?: Set<string>,
): Node[] {
  const positions = computeLayout(dataNodes)
  return dataNodes.map(n => {
    const col = KIND_COLOR[n.kind] ?? DEFAULT_KIND
    const highlighted = highlightIds?.has(n.id)
    const isNew = newIds?.has(n.id)
    return {
      id: n.id,
      position: positions[n.id] ?? { x: 0, y: 0 },
      data: { label: '', preview: n.preview, assetName: n.asset_name, kind: n.kind },
      style: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: highlighted ? '#D97706' : col.bg,
        border: `2px solid ${highlighted ? '#B45309' : col.border}`,
        boxShadow: highlighted ? '0 0 8px rgba(217,119,6,0.6)' : undefined,
        cursor: 'pointer',
        // animate new nodes popping in
        animation: isNew ? 'kg-node-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
        opacity: isNew ? 0 : 1,
      },
      type: 'default',
    }
  })
}

function buildRfEdges(edges: GraphData['edges'], animated = false): Edge[] {
  return edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    style: { stroke: '#CBD5E1', strokeWidth: 1, opacity: 0.4 },
    animated,
  }))
}

interface Props {
  data: GraphData
  highlightIds?: Set<string>
  isLive?: boolean  // true while an asset is being processed — animates edges
}

export function KnowledgeGraph({ data, highlightIds, isLive }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const prevNodeIds = useRef(new Set<string>())

  const initialNodes = useMemo(
    () => buildRfNodes(data.nodes, highlightIds, new Set()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const initialEdges = useMemo(() => buildRfEdges(data.edges, isLive), []) // eslint-disable-line

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync nodes from data prop — detect new ones and animate them
  useEffect(() => {
    const newIds = new Set(
      data.nodes.filter(n => !prevNodeIds.current.has(n.id)).map(n => n.id)
    )
    prevNodeIds.current = new Set(data.nodes.map(n => n.id))
    setNodes(buildRfNodes(data.nodes, highlightIds, newIds))
  }, [data.nodes, highlightIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync edges from data prop
  useEffect(() => {
    setEdges(buildRfEdges(data.edges, isLive))
  }, [data.edges, isLive]) // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setTooltip({ x: node.position.x, y: node.position.y, text: `${node.data.assetName}: ${node.data.preview}` })
  }, [])
  const onNodeMouseLeave = useCallback(() => setTooltip(null), [])

  const assetNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const n of data.nodes) m[n.asset_id] = n.asset_name
    return Object.values(m)
  }, [data.nodes])

  if (data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/>
          <circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/>
          <line x1="6" y1="7" x2="10" y2="11"/><line x1="18" y1="7" x2="14" y2="11"/>
          <line x1="6" y1="17" x2="10" y2="13"/><line x1="18" y1="17" x2="14" y2="13"/>
        </svg>
        <div>No knowledge graph yet — upload and process assets first</div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-amber-600 text-xs mt-1">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Building graph…
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* inject keyframe via style tag — one per page mount, harmless */}
      <style>{`
        @keyframes kg-node-in {
          from { opacity: 0; transform: scale(0.1); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="relative w-full h-full">
        {isLive && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-amber-200 rounded-full px-3 py-1 text-xs text-amber-700 shadow-sm">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            Building graph…
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.1}
        >
          <Background variant={BackgroundVariant.Dots} color="#E2E8F0" gap={20} size={1} />
          <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-sm" />
        </ReactFlow>

        {/* Legend */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-sm">
          <div className="font-semibold text-slate-700 mb-1.5">{data.nodes.length} chunks · {assetNames.length} docs</div>
          <div className="space-y-1">
            {Object.entries(KIND_COLOR).map(([kind, col]) => (
              <div key={kind} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border" style={{ background: col.bg, borderColor: col.border }} />
                <span className="text-slate-500 capitalize">{kind}</span>
              </div>
            ))}
          </div>
        </div>

        {tooltip && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg max-w-xs text-center shadow-lg pointer-events-none">
            {tooltip.text}
          </div>
        )}
      </div>
    </>
  )
}
