'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { EntityGraphData } from '@/lib/api'

const KIND_COLOR: Record<string, string> = {
  person:   '#3B82F6',  // blue
  company:  '#22C55E',  // green
  location: '#8B5CF6',  // purple
  metric:   '#F97316',  // orange
  concept:  '#14B8A6',  // teal
}
const DEFAULT_COLOR = '#94A3B8'

interface Props {
  data: EntityGraphData
}

export function EntityGraph({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const initGraph = useCallback(async () => {
    if (!containerRef.current || !mounted) return
    const { default: ForceGraph2D } = await import('react-force-graph-2d')
    const container = containerRef.current

    // Build graph data in force-graph format
    const graphData = {
      nodes: data.nodes.map(n => ({ ...n, color: KIND_COLOR[n.kind] ?? DEFAULT_COLOR })),
      links: data.edges.map(e => ({ source: e.source, target: e.target, value: e.weight })),
    }

    // Dynamically render — ForceGraph2D is canvas-based, can't use JSX directly here
    // so we mount it imperatively via a temporary div trick with React DOM
    const { createRoot } = await import('react-dom/client')
    const el = document.createElement('div')
    el.style.cssText = 'width:100%;height:100%'
    container.innerHTML = ''
    container.appendChild(el)

    const root = createRoot(el)
    root.render(
      <ForceGraph2D
        graphData={graphData}
        width={container.clientWidth}
        height={container.clientHeight}
        nodeLabel="name"
        nodeColor={n => (n as any).color}
        nodeRelSize={6}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as any
          const r = 6
          // circle
          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
          ctx.fillStyle = n.color
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 1.5 / globalScale
          ctx.stroke()
          // label — only show when zoomed in enough
          if (globalScale >= 0.6) {
            const label = n.name.length > 20 ? n.name.slice(0, 18) + '…' : n.name
            const fontSize = Math.max(10, 12 / globalScale)
            ctx.font = `${fontSize}px Inter,sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#1E293B'
            ctx.fillText(label, n.x, n.y + r + fontSize * 0.8)
          }
        }}
        nodeCanvasObjectMode={() => 'replace'}
        linkColor={() => '#CBD5E1'}
        linkWidth={link => Math.min(3, (link as any).value ?? 1)}
        linkDirectionalParticles={0}
        backgroundColor="#F8FAFC"
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    )

    graphRef.current = root
  }, [data, mounted])

  useEffect(() => {
    initGraph()
    return () => {
      graphRef.current?.unmount()
      graphRef.current = null
    }
  }, [initGraph])

  if (!mounted) return null

  if (data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/>
          <circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/>
          <line x1="6" y1="7" x2="10" y2="11"/><line x1="18" y1="7" x2="14" y2="11"/>
          <line x1="6" y1="17" x2="10" y2="13"/><line x1="18" y1="17" x2="14" y2="13"/>
        </svg>
        <div>No entities found — upload and process assets first</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-sm">
        <div className="font-semibold text-slate-700 mb-1.5">{data.nodes.length} entities · {data.edges.length} links</div>
        <div className="space-y-1">
          {Object.entries(KIND_COLOR).map(([kind, color]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-slate-500 capitalize">{kind}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-xs text-slate-400 absolute bottom-3 left-3 z-10">
        Scroll to zoom · drag to pan
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
