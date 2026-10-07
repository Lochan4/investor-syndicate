'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { EntityGraphData } from '@/lib/api'

// Asset nodes — large, colored by file type
const ASSET_COLOR: Record<string, string> = {
  pdf:         '#3B82F6',  // blue
  audio:       '#F97316',  // orange
  image:       '#22C55E',  // green
  spreadsheet: '#8B5CF6',  // purple
}
// Concept child nodes
const CONCEPT_COLOR: Record<string, string> = {
  topic:  '#D97706',  // amber
  entity: '#14B8A6',  // teal
}
const DEFAULT_COLOR = '#94A3B8'

function nodeColor(n: any): string {
  if (n.node_type === 'asset') return ASSET_COLOR[n.kind] ?? DEFAULT_COLOR
  return CONCEPT_COLOR[n.kind] ?? DEFAULT_COLOR
}

function nodeRadius(n: any): number {
  return n.node_type === 'asset' ? 14 : 7
}

interface Props { data: EntityGraphData }

export function EntityGraph({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const initGraph = useCallback(async () => {
    if (!containerRef.current || !mounted) return

    const container = containerRef.current
    const { default: ForceGraph2D } = await import('react-force-graph-2d')
    const { createRoot } = await import('react-dom/client')

    const graphData = {
      nodes: data.nodes.map(n => ({ ...n, color: nodeColor(n), r: nodeRadius(n) })),
      links: data.edges.map(e => ({ source: e.source, target: e.target })),
    }

    container.innerHTML = ''
    const el = document.createElement('div')
    el.style.cssText = 'width:100%;height:100%'
    container.appendChild(el)

    if (rootRef.current) { rootRef.current.unmount(); rootRef.current = null }
    const root = createRoot(el)
    rootRef.current = root

    root.render(
      <ForceGraph2D
        graphData={graphData}
        width={container.clientWidth || 900}
        height={container.clientHeight || 600}
        nodeLabel="name"
        nodeRelSize={1}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as any
          const r = n.r ?? 7

          // Glow for asset nodes
          if (n.node_type === 'asset') {
            ctx.beginPath()
            ctx.arc(n.x, n.y, r + 4, 0, 2 * Math.PI)
            ctx.fillStyle = n.color + '33'
            ctx.fill()
          }

          // Main circle
          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
          ctx.fillStyle = n.color
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'
          ctx.lineWidth = n.node_type === 'asset' ? 2.5 / globalScale : 1.5 / globalScale
          ctx.stroke()

          // Label — always visible for asset nodes, zoom-gated for concepts
          const showLabel = n.node_type === 'asset' || globalScale >= 0.7
          if (showLabel) {
            const maxLen = n.node_type === 'asset' ? 22 : 18
            const raw = n.name as string
            const label = raw.length > maxLen ? raw.slice(0, maxLen - 1) + '…' : raw
            const fontSize = n.node_type === 'asset'
              ? Math.max(11, 13 / globalScale)
              : Math.max(9, 11 / globalScale)
            ctx.font = `${n.node_type === 'asset' ? '600 ' : ''}${fontSize}px Inter,sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            // White background pill for readability
            const tw = ctx.measureText(label).width
            const pad = 3 / globalScale
            ctx.fillStyle = 'rgba(255,255,255,0.85)'
            ctx.beginPath()
            const lx = n.x - tw / 2 - pad
            const ly = n.y + r + 3 / globalScale
            const lw = tw + pad * 2
            const lh = fontSize + pad * 2
            ctx.roundRect(lx, ly, lw, lh, 2 / globalScale)
            ctx.fill()

            ctx.fillStyle = '#1E293B'
            ctx.fillText(label, n.x, n.y + r + 3 / globalScale + pad)
          }
        }}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as any
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(n.x, n.y, (n.r ?? 7) + 6, 0, 2 * Math.PI)
          ctx.fill()
        }}
        linkColor={() => 'rgba(148,163,184,0.5)'}
        linkWidth={1}
        linkDirectionalParticles={0}
        backgroundColor="#F8FAFC"
        cooldownTicks={150}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        // Asset nodes repel more — creates natural hub-and-spoke clustering
        onEngineStop={() => {}}
      />
    )
  }, [data, mounted])

  useEffect(() => {
    initGraph()
    return () => { rootRef.current?.unmount(); rootRef.current = null }
  }, [initGraph])

  if (!mounted) return null

  const assetCount = data.nodes.filter(n => (n as any).node_type === 'asset').length
  const conceptCount = data.nodes.filter(n => (n as any).node_type === 'concept').length

  if (data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/>
          <circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/>
          <line x1="6" y1="7" x2="10" y2="11"/><line x1="18" y1="7" x2="14" y2="11"/>
          <line x1="6" y1="17" x2="10" y2="13"/><line x1="18" y1="17" x2="14" y2="13"/>
        </svg>
        <div className="text-center">
          <div className="font-medium text-slate-500 mb-1">No knowledge graph yet</div>
          <div className="text-xs text-slate-400">Upload assets and wait for processing to complete</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2.5 text-xs shadow-sm">
        <div className="font-semibold text-slate-700 mb-2">
          {assetCount} asset{assetCount !== 1 ? 's' : ''} · {conceptCount} concepts
        </div>
        <div className="space-y-1.5">
          <div className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold mb-1">Assets</div>
          {Object.entries(ASSET_COLOR).map(([kind, color]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: color }} />
              <span className="text-slate-500 capitalize">{kind}</span>
            </div>
          ))}
          <div className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold mt-2 mb-1">Concepts</div>
          {Object.entries(CONCEPT_COLOR).map(([kind, color]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-slate-500 capitalize">{kind}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 left-3 z-10 text-[11px] text-slate-400">
        Scroll to zoom · drag to pan
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
