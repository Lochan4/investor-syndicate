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

const CHUNK_COLS = 5
const CHUNK_GAP  = 80   // px between chunk nodes
const GROUP_GAP  = 180  // horizontal gap between asset groups
const ASSET_Y    = 0    // asset parent node Y
const CHUNKS_Y   = 100  // chunks start Y (below parent)

function buildGraphElements(
  dataNodes: GraphData['nodes'],
  dataEdges: GraphData['edges'],
  highlightIds?: Set<string>,
  newIds?: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  // Group chunks by asset
  const groups: Record<string, GraphData['nodes']> = {}
  const assetMeta: Record<string, { name: string; kind: string }> = {}
  for (const n of dataNodes) {
    if (!groups[n.asset_id]) {
      groups[n.asset_id] = []
      assetMeta[n.asset_id] = { name: n.asset_name, kind: n.kind }
    }
    groups[n.asset_id].push(n)
  }

  const rfNodes: Node[] = []
  const rfEdges: Edge[] = []

  let groupOffsetX = 0

  for (const [assetId, chunks] of Object.entries(groups)) {
    const { name, kind } = assetMeta[assetId]
    const col = KIND_COLOR[kind] ?? DEFAULT_KIND
    const groupCols = Math.min(chunks.length, CHUNK_COLS)
    const groupWidth = groupCols * CHUNK_GAP

    // ── Asset parent node ─────────────────────────────────
    const assetNodeId = `asset-${assetId}`
    rfNodes.push({
      id: assetNodeId,
      position: { x: groupOffsetX + groupWidth / 2 - 60, y: ASSET_Y },
      data: { label: name.length > 24 ? name.slice(0, 22) + '…' : name },
      style: {
        width: 120,
        height: 32,
        borderRadius: 16,
        background: col.bg,
        border: `2px solid ${col.border}`,
        color: col.text,
        fontSize: 11,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
      type: 'default',
    })

    // ── Chunk nodes ───────────────────────────────────────
    chunks.forEach((chunk, ci) => {
      const cx = groupOffsetX + (ci % CHUNK_COLS) * CHUNK_GAP
      const cy = CHUNKS_Y + Math.floor(ci / CHUNK_COLS) * CHUNK_GAP
      const highlighted = highlightIds?.has(chunk.id)
      const isNew = newIds?.has(chunk.id)

      rfNodes.push({
        id: chunk.id,
        position: { x: cx, y: cy },
        data: { label: '', preview: chunk.preview, assetName: name, kind },
        style: {
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: highlighted ? '#D97706' : col.bg,
          border: `2px solid ${highlighted ? '#B45309' : col.border}`,
          boxShadow: highlighted ? '0 0 8px rgba(217,119,6,0.6)' : undefined,
          cursor: 'pointer',
          animation: isNew ? 'kg-node-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
          opacity: isNew ? 0 : 1,
        },
        type: 'default',
      })

      // Edge: asset → chunk
      rfEdges.push({
        id: `parent-${assetId}-${ci}`,
        source: assetNodeId,
        target: chunk.id,
        style: { stroke: col.border, strokeWidth: 1, opacity: 0.25 },
        animated: false,
      })
    })

    groupOffsetX += groupCols * CHUNK_GAP + GROUP_GAP
  }

  // ── KG similarity / next edges ────────────────────────
  dataEdges.forEach((e, i) => {
    rfEdges.push({
      id: `kg-${i}`,
      source: e.source,
      target: e.target,
      style: { stroke: '#CBD5E1', strokeWidth: 1, opacity: 0.35 },
      animated: false,
    })
  })

  return { nodes: rfNodes, edges: rfEdges }
}

interface Props {
  data: GraphData
  highlightIds?: Set<string>
  isLive?: boolean
}

export function KnowledgeGraph({ data, highlightIds, isLive }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const prevNodeIds = useRef<string>('')

  const initial = useMemo(
    () => buildGraphElements(data.nodes, data.edges, highlightIds, new Set()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)

  // Only rebuild when node IDs actually change (not on every poll re-render)
  useEffect(() => {
    const key = data.nodes.map(n => n.id).sort().join(',')
    if (key === prevNodeIds.current) return
    const prevSet = new Set(prevNodeIds.current.split(',').filter(Boolean))
    prevNodeIds.current = key
    const newIds = new Set(data.nodes.filter(n => !prevSet.has(n.id)).map(n => n.id))
    const { nodes: n, edges: e } = buildGraphElements(data.nodes, data.edges, highlightIds, newIds)
    setNodes(n)
    setEdges(e)
  }, [data.nodes, data.edges, highlightIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    if (!node.data.preview) return
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
          fitViewOptions={{ padding: 0.2 }}
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
