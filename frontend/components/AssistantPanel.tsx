'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { streamActivityFeed, ActivityEvent } from '@/lib/api'

// react-force-graph-2d uses browser canvas — must be client-only
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

type ResearchSession = {
  id: string
  intent?: string
  queries: string[]
  results: any[]
  pages: string[]
}

// ── Icons ────────────────────────────────────────────────

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function NetworkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="12" y1="7" x2="7" y2="17" />
      <line x1="12" y1="7" x2="17" y2="17" />
      <line x1="7" y1="19" x2="17" y2="19" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5-5-5m5 5v-4m0 4h-4" />
    </svg>
  )
}

function MinimizeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
    </svg>
  )
}

// ── Window pill (minimized state on canvas) ───────────────

function WindowPill({ label, icon, onClick }: {
  label: string; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-stroke rounded-lg shadow-sm text-xs text-ink hover:border-amber hover:text-amber transition-all animate-fade-in"
    >
      <span className="text-amber shrink-0">{icon}</span>
      <span className="max-w-[140px] truncate">{label}</span>
      <MaximizeIcon />
    </button>
  )
}

// ── Floating window shell ─────────────────────────────────

function FloatingWindow({ title, icon, onMinimize, children, noScroll }: {
  title: string
  icon: React.ReactNode
  onMinimize: () => void
  children: React.ReactNode
  noScroll?: boolean
}) {
  return (
    <div className="absolute inset-3 flex flex-col bg-surface border border-stroke rounded-xl shadow-lg overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stroke shrink-0">
        <span className="text-amber shrink-0">{icon}</span>
        <span className="font-medium text-sm text-ink truncate">{title}</span>
        <button
          onClick={onMinimize}
          className="ml-auto w-6 h-6 flex items-center justify-center rounded text-muted hover:text-ink hover:bg-background transition-colors shrink-0"
          title="Minimize"
        >
          <MinimizeIcon />
        </button>
      </div>
      <div className={`flex-1 text-sm ${noScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {children}
      </div>
    </div>
  )
}

// ── Research window content ───────────────────────────────

function ResearchContent({ session }: { session: ResearchSession }) {
  const [showAll, setShowAll] = useState(false)
  const preview = showAll ? session.results : session.results.slice(0, 5)

  return (
    <div className="px-5 py-4 space-y-5">
      {session.intent && (
        <p className="text-xs text-muted leading-relaxed italic border-l-2 border-amber/40 pl-3">
          {session.intent}
        </p>
      )}

      {session.queries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-subtle uppercase tracking-wide mb-2">Searched for</p>
          <div className="flex flex-wrap gap-1.5">
            {session.queries.map((q, i) => (
              <span key={i} className="text-xs bg-amber/8 text-amber-800 border border-amber/20 px-2.5 py-1 rounded-full">
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {session.results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-subtle uppercase tracking-wide">Results</p>
            <span className="text-xs text-subtle">{session.results.length} sources</span>
          </div>
          <div className="space-y-4">
            {preview.map((r: any, i: number) => (
              <div key={i}>
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="group block">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-subtle shrink-0 w-4 text-right mt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink group-hover:text-amber transition-colors leading-snug">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {r.link?.replace(/^https?:\/\//, '').split('/')[0]}
                      </p>
                    </div>
                  </div>
                  {r.snippet && (
                    <p className="text-xs text-subtle mt-1.5 ml-6 line-clamp-2 leading-relaxed">
                      {r.snippet}
                    </p>
                  )}
                </a>
                {i < preview.length - 1 && <div className="mt-3 border-t border-stroke/50" />}
              </div>
            ))}
          </div>
          {session.results.length > 5 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="mt-3 text-xs text-amber hover:text-amber-700 transition-colors ml-6"
            >
              {showAll ? 'Show fewer' : `+ ${session.results.length - 5} more sources`}
            </button>
          )}
        </div>
      )}

      {session.pages.length > 0 && (
        <div>
          <p className="text-xs font-medium text-subtle uppercase tracking-wide mb-2">Pages read</p>
          <div className="flex flex-wrap gap-2">
            {session.pages.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted hover:text-amber transition-colors truncate max-w-[180px] bg-background border border-stroke rounded px-2 py-0.5"
              >
                {url.replace(/^https?:\/\//, '').split('/').slice(0, 2).join('/')}
              </a>
            ))}
          </div>
        </div>
      )}

      {session.queries.length === 0 && session.results.length === 0 && (
        <p className="text-xs text-subtle">Searching…</p>
      )}
    </div>
  )
}

// ── KG graph ──────────────────────────────────────────────

function KGGraph({ projectId, token }: { projectId: string; token: string }) {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    fetch(`${BASE}/projects/${projectId}/assets/entity-graph`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { nodes: [], edges: [] })
      .then(d => {
        // deep copy — react-force-graph-2d mutates nodes with x/y/vx/vy
        const nodes = (d.nodes || []).map((n: any) => ({ ...n }))
        const links = (d.edges || []).map((e: any) => ({ source: e.source, target: e.target }))
        setGraphData({ nodes, links })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId, token])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const nodeColor = useCallback((node: any) => {
    if (node.node_type === 'asset') return '#d97706'
    if (node.kind === 'topic') return '#6366f1'
    return '#10b981'
  }, [])

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const isAsset = node.node_type === 'asset'
    const r = isAsset ? 7 : 4
    const x = node.x as number
    const y = node.y as number

    // node circle
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = nodeColor(node)
    ctx.fill()

    if (isAsset) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // label — always for assets, only when zoomed in for concepts
    if (isAsset || scale > 1.8) {
      const label = (node.name as string) || ''
      const fontSize = Math.max(6, 11 / scale)
      ctx.font = `${isAsset ? 600 : 400} ${fontSize}px -apple-system, sans-serif`
      ctx.fillStyle = isAsset ? '#1f2937' : '#6b7280'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const display = label.length > 22 ? label.slice(0, 20) + '…' : label
      ctx.fillText(display, x, y + r + 2)
    }
  }, [nodeColor])

  return (
    <div ref={containerRef} className="w-full h-full">
      {loading ? (
        <div className="flex items-center justify-center h-full text-xs text-subtle">Loading…</div>
      ) : graphData.nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-subtle">
          <NetworkIcon className="w-8 h-8 opacity-20" />
          <p className="text-xs">No documents indexed yet</p>
        </div>
      ) : dims.w > 0 ? (
        <>
          <ForceGraph2D
            graphData={graphData}
            width={dims.w}
            height={dims.h}
            nodeLabel="name"
            nodeColor={nodeColor}
            linkColor={() => 'rgba(156,163,175,0.5)'}
            linkWidth={1}
            nodeRelSize={5}
            backgroundColor="transparent"
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            cooldownTicks={120}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
          {/* Legend */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
            {[
              { color: '#d97706', label: 'Document' },
              { color: '#6366f1', label: 'Topic' },
              { color: '#10b981', label: 'Entity' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────

export function AssistantPanel({ projectId, cellId, token }: {
  projectId: string; cellId: string; token: string
}) {
  const [sessions, setSessions] = useState<ResearchSession[]>([])
  const [activeWindow, setActiveWindow] = useState<string | null>(null) // session id | 'kg' | null
  const [active, setActive] = useState(false)

  useEffect(() => {
    let stop: (() => void) | undefined
    const start = (t: string) => {
      stop = streamActivityFeed(projectId, cellId, t, (e: ActivityEvent) => {
        if (e.type === 'intent') {
          setActive(true)
          const id = Date.now().toString()
          const session: ResearchSession = {
            id,
            intent: e.data.intent,
            queries: e.data.queries || [],
            results: [],
            pages: [],
          }
          setSessions(prev => [...prev, session])
          setActiveWindow(id)
        } else if (e.type === 'search_done') {
          setSessions(prev => {
            const last = prev[prev.length - 1]
            if (!last) return prev
            return [...prev.slice(0, -1), { ...last, results: e.data.results || [] }]
          })
        } else if (e.type === 'browser_start') {
          setSessions(prev => {
            const last = prev[prev.length - 1]
            if (!last) return prev
            return [...prev.slice(0, -1), { ...last, pages: [...last.pages, e.data.url] }]
          })
        } else if (e.type === 'kg_done' || e.type === 'error') {
          setActive(false)
        }
      })
    }
    fetch('/api/token')
      .then(r => r.ok ? r.json() : null)
      .then(d => start(d?.token || token))
      .catch(() => start(token))
    return () => stop?.()
  }, [projectId, cellId, token])

  const openSession = activeWindow && activeWindow !== 'kg'
    ? sessions.find(s => s.id === activeWindow) ?? null
    : null
  const minimizedSessions = sessions.filter(s => s.id !== activeWindow)
  const kgMinimized = sessions.length > 0 && activeWindow !== 'kg' // show KG pill once user has opened it — handled via button state

  // Pills: sessions not currently open + KG if it was open before and user minimized it
  const hasPills = minimizedSessions.length > 0

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stroke flex items-center gap-2">
        <span className="section-header">Assets</span>
        <div className="ml-auto flex items-center gap-2">
          {active && <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />}
          <button
            onClick={() => setActiveWindow(w => w === 'kg' ? null : 'kg')}
            title="Knowledge graph"
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              activeWindow === 'kg' ? 'bg-amber/15 text-amber' : 'text-muted hover:text-ink hover:bg-background'
            }`}
          >
            <NetworkIcon />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">

        {/* Empty state */}
        {sessions.length === 0 && activeWindow !== 'kg' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <svg className="w-8 h-8 opacity-10" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            <p className="text-xs text-center max-w-[160px] text-subtle opacity-40">
              Research results and knowledge graph will appear here
            </p>
          </div>
        )}

        {/* Open: research session */}
        {openSession && (
          <FloatingWindow
            title={openSession.intent || 'Research'}
            icon={<SearchIcon />}
            onMinimize={() => setActiveWindow(null)}
          >
            <ResearchContent session={openSession} />
          </FloatingWindow>
        )}

        {/* Open: KG graph */}
        {activeWindow === 'kg' && (
          <FloatingWindow
            title="Knowledge Graph"
            icon={<NetworkIcon />}
            onMinimize={() => setActiveWindow(null)}
            noScroll
          >
            <KGGraph projectId={projectId} token={token} />
          </FloatingWindow>
        )}

        {/* Minimized pills — stay on canvas at bottom */}
        {hasPills && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
            {minimizedSessions.map(s => (
              <WindowPill
                key={s.id}
                label={s.intent || 'Research'}
                icon={<SearchIcon className="w-3 h-3" />}
                onClick={() => setActiveWindow(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
