'use client'
import { useState, useEffect, useRef } from 'react'
import { streamActivityFeed, ActivityEvent, CitationSource } from '@/lib/api'
import { BorderTrail } from '@/components/core/border-trail'

function MicButton() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const handler = (e: Event) => setActive((e as CustomEvent).detail.recording)
    window.addEventListener('mic-state', handler)
    return () => window.removeEventListener('mic-state', handler)
  }, [])
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('mic-trigger'))}
      title="Hold Space or click to record"
      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 ${
        active
          ? 'bg-red-500 text-white scale-110 animate-pulse'
          : 'bg-amber text-white hover:bg-amber-600'
      }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  )
}

type CardType = 'web' | 'maps' | 'company' | 'citation' | 'summary'
type DockEdge = 'left' | 'right' | 'top' | 'bottom'

interface WindowCard {
  id: string
  type: CardType
  title: string
  data: any
  docked: DockEdge | null
  showDockPicker: boolean
  x: number
  y: number
}

// ── Icons ──────────────────────────────────────────────────

function DockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function ArrowIcon({ dir }: { dir: DockEdge }) {
  const paths: Record<DockEdge, string> = {
    left:   "M15 19l-7-7 7-7",
    right:  "M9 5l7 7-7 7",
    top:    "M5 15l7-7 7 7",
    bottom: "M19 9l-7 7-7-7",
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[dir]} />
    </svg>
  )
}

// ── Dock picker overlay ────────────────────────────────────

function DockPicker({ onDock, onClose }: { onDock: (edge: DockEdge) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-surface/80 backdrop-blur-sm rounded-xl">
      <div className="relative w-20 h-20">
        {(['top', 'bottom', 'left', 'right'] as DockEdge[]).map(dir => (
          <button
            key={dir}
            onClick={() => onDock(dir)}
            className="absolute w-7 h-7 flex items-center justify-center rounded-md bg-amber/10 hover:bg-amber/25 text-amber transition-colors border border-amber/20"
            style={{
              top:    dir === 'top'    ? 0   : dir === 'bottom' ? 'auto' : '50%',
              bottom: dir === 'bottom' ? 0   : 'auto',
              left:   dir === 'left'  ? 0   : dir === 'right'  ? 'auto' : '50%',
              right:  dir === 'right' ? 0   : 'auto',
              transform: (dir === 'top' || dir === 'bottom') ? 'translateX(-50%)' : 'translateY(-50%)',
            }}
          >
            <ArrowIcon dir={dir} />
          </button>
        ))}
        <button
          onClick={onClose}
          className="absolute inset-0 m-auto w-6 h-6 flex items-center justify-center rounded text-muted hover:text-ink text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Card shell ─────────────────────────────────────────────

function Card({ card, loading, onToggleDock, onDock, children }: {
  card: WindowCard
  loading: boolean
  onToggleDock: () => void
  onDock: (edge: DockEdge) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative bg-white border border-stroke rounded-xl shadow-sm overflow-hidden shrink-0">
      {loading && (
        <BorderTrail
          size={100}
          duration={2.5}
          style={{
            boxShadow:
              '0 0 40px 16px rgba(212,126,48,0.55), 0 0 80px 40px rgba(212,126,48,0.25), 0 0 120px 60px rgba(212,126,48,0.10)',
          }}
        />
      )}
      {card.showDockPicker && (
        <DockPicker onDock={onDock} onClose={onToggleDock} />
      )}
      {children}
    </div>
  )
}

function CardHeader({ title, icon, onToggleDock, onDragStart }: {
  title: string; icon: React.ReactNode; onToggleDock: () => void
  onDragStart: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-stroke bg-surface/50 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onDragStart}
    >
      <span className="text-amber shrink-0">{icon}</span>
      <span className="text-xs font-medium text-ink truncate flex-1">{title}</span>
      <button
        onClick={e => { e.stopPropagation(); onToggleDock() }}
        onMouseDown={e => e.stopPropagation()}
        title="Dock window"
        className="w-5 h-5 flex items-center justify-center rounded text-amber hover:text-amber-700 transition-colors shrink-0"
      >
        <DockIcon />
      </button>
    </div>
  )
}

// ── Card renderers ─────────────────────────────────────────

function MapsCard({ data }: { data: any }) {
  const query = encodeURIComponent(data.queries?.[0] || data.intent || '')
  return (
    <iframe
      className="w-full"
      style={{ height: 220, border: 0 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://maps.google.com/maps?q=${query}&t=&z=11&ie=UTF8&iwloc=&output=embed`}
    />
  )
}

function CompanyCard({ data }: { data: any }) {
  const results: any[] = data.results || []
  if (!results.length) return <div className="px-3 py-4 text-xs text-muted">Searching…</div>
  return (
    <div className="px-3 py-3 space-y-3 max-h-64 overflow-y-auto">
      {results.slice(0, 6).map((r: any, i: number) => (
        <a
          key={i}
          href={r.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted shrink-0 w-4 text-right mt-0.5">{i + 1}</span>
            <div>
              <p className="text-xs font-semibold text-ink group-hover:text-amber transition-colors leading-snug">{r.title}</p>
              <p className="text-xs text-muted truncate mt-0.5">{r.link?.replace(/^https?:\/\//, '').split('/')[0]}</p>
              {r.snippet && <p className="text-xs text-subtle mt-1 line-clamp-2 leading-relaxed">{r.snippet}</p>}
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

function WebCard({ data }: { data: any }) {
  const results: any[] = data.results || []
  return (
    <div className="px-3 py-3 space-y-3 max-h-64 overflow-y-auto">
      {data.intent && (
        <p className="text-xs text-muted italic border-l-2 border-amber/30 pl-2 leading-relaxed">{data.intent}</p>
      )}
      {!results.length && <p className="text-xs text-muted">Searching…</p>}
      {results.slice(0, 6).map((r: any, i: number) => (
        <a key={i} href={r.link} target="_blank" rel="noopener noreferrer" className="block group">
          <p className="text-xs font-semibold text-ink group-hover:text-amber transition-colors leading-snug">{r.title}</p>
          {r.snippet && <p className="text-xs text-subtle mt-0.5 line-clamp-2 leading-relaxed">{r.snippet}</p>}
        </a>
      ))}
    </div>
  )
}

function CitationCard({ data }: { data: CitationSource }) {
  const name = data.name || ''
  const e = name.split('.').pop()?.toLowerCase() ?? ''
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(e)
  const isAudio = ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(e)
  const isVideo = ['mp4', 'webm', 'mov'].includes(e)
  const isPdf   = e === 'pdf'

  return (
    <div className="p-3 space-y-2">
      {data.chunk_preview && (
        <blockquote className="border-l-2 border-amber/40 pl-3 text-xs text-ink leading-relaxed italic line-clamp-4">
          {data.chunk_preview}
        </blockquote>
      )}
      {data.url && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.url} alt={name} className="w-full rounded-lg max-h-48 object-contain bg-stone-50" />
      )}
      {data.url && isAudio && (
        <audio controls src={data.url} className="w-full h-8" style={{ accentColor: '#D47E30' }} />
      )}
      {data.url && isVideo && (
        <video controls src={data.url} className="w-full rounded-lg max-h-48" />
      )}
      {data.url && isPdf && (
        <iframe src={data.url} className="w-full rounded-lg" style={{ height: 220, border: 0 }} title={name} />
      )}
      {data.url && !isImage && !isAudio && !isVideo && !isPdf && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-amber hover:text-amber-700 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Open file
        </a>
      )}
    </div>
  )
}

function SummaryCard({ data }: { data: { text: string } }) {
  return (
    <div className="px-3 py-3 max-h-72 overflow-y-auto">
      <pre className="text-xs text-ink whitespace-pre-wrap leading-relaxed font-sans">{data.text}</pre>
    </div>
  )
}

// ── Docked tab strip ───────────────────────────────────────

function DockedTab({ card, onUndock }: { card: WindowCard; onUndock: () => void }) {
  return (
    <button
      onClick={onUndock}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-stroke rounded-lg shadow-sm text-xs text-ink hover:border-amber hover:text-amber transition-all max-w-[120px]"
      title={card.title}
    >
      <span className="truncate">{card.title}</span>
      <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    </button>
  )
}

// ── Card type icons ────────────────────────────────────────

function cardIcon(type: CardType) {
  if (type === 'maps') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
  if (type === 'company') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
    </svg>
  )
  if (type === 'citation') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
  if (type === 'summary') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 9.75h7.5M8.25 12.75h4.5M3.75 3h16.5A.75.75 0 0 1 21 3.75v16.5A.75.75 0 0 1 20.25 21H3.75A.75.75 0 0 1 3 20.25V3.75A.75.75 0 0 1 3.75 3Z" />
    </svg>
  )
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────

const STORAGE_KEY = (cellId: string) => `canvas-cards-${cellId}`

// Predefined grid zones — 8 positions spread across the canvas so new windows don't stack
const GRID_POSITIONS = [
  { x: 20,  y: 20  },
  { x: 340, y: 20  },
  { x: 660, y: 20  },
  { x: 20,  y: 320 },
  { x: 340, y: 320 },
  { x: 660, y: 320 },
  { x: 20,  y: 620 },
  { x: 340, y: 620 },
]

export function WindowCanvas({ projectId, cellId, token }: {
  projectId: string; cellId: string; token: string
}) {
  const [cards, setCards] = useState<WindowCard[]>(() => {
    // Restore persisted cards on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY(cellId))
      if (saved) {
        const parsed: WindowCard[] = JSON.parse(saved)
        return parsed
      }
    } catch {}
    return []
  })
  const cardsRef = useRef<WindowCard[]>([])
  const tokenRef = useRef(token)
  const idCounter = useRef(0)
  const dragState = useRef<{
    id: string; startMouseX: number; startMouseY: number; startCardX: number; startCardY: number
  } | null>(null)

  // Sync idCounter to max card id so new cards don't collide
  useEffect(() => {
    if (cards.length) {
      idCounter.current = Math.max(...cards.map(c => parseInt(c.id) || 0))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep cardsRef in sync for dedup lookups inside callbacks
  useEffect(() => { cardsRef.current = cards }, [cards])

  // Persist cards whenever they change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY(cellId), JSON.stringify(cards)) } catch {}
  }, [cards, cellId])

  useEffect(() => {
    fetch('/api/token').then(r => r.ok ? r.json() : null).then(d => { if (d?.token) tokenRef.current = d.token }).catch(() => {})
  }, [])

  const newId = () => String(++idCounter.current)

  const addCard = (type: CardType, title: string, data: any): string => {
    // Dedup: if an undocked card of the same type+title already exists, update it in place
    const existing = cardsRef.current.find(c => c.docked === null && c.type === type && c.title === title)
    if (existing) {
      setCards(prev => prev.map(c => c.id === existing.id ? { ...c, data: { ...c.data, ...data } } : c))
      return existing.id
    }
    const id = newId()
    const pos = GRID_POSITIONS[(idCounter.current - 1) % GRID_POSITIONS.length]
    setCards(prev => [...prev, { id, type, title, data, docked: null, showDockPicker: false, x: pos.x, y: pos.y }])
    return id
  }

  const startDrag = (id: string, cardX: number, cardY: number, e: React.MouseEvent) => {
    e.preventDefault()
    dragState.current = { id, startMouseX: e.clientX, startMouseY: e.clientY, startCardX: cardX, startCardY: cardY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current) return
    const { id, startMouseX, startMouseY, startCardX, startCardY } = dragState.current
    const dx = e.clientX - startMouseX
    const dy = e.clientY - startMouseY
    setCards(prev => prev.map(c => c.id === id
      ? { ...c, x: Math.max(0, startCardX + dx), y: Math.max(0, startCardY + dy) }
      : c
    ))
  }

  const stopDrag = () => { dragState.current = null }

  const updateCard = (id: string, patch: Partial<WindowCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const dockCard = (id: string, edge: DockEdge) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, docked: edge, showDockPicker: false } : c))
  }

  const undockCard = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, docked: null } : c))
  }

  const toggleDockPicker = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, showDockPicker: !c.showDockPicker } : c))
  }

  // Shared dock helper: match by title substring, both SSE and voice commands use this
  const dockByHint = (hint: string, edge: DockEdge) => {
    const h = hint.toLowerCase()
    setCards(prev => {
      const match = prev.find(c =>
        c.docked === null && (c.title.toLowerCase().includes(h) || h.includes(c.title.toLowerCase()))
      )
      if (!match) return prev
      return prev.map(c => c.id === match.id ? { ...c, docked: edge, showDockPicker: false } : c)
    })
  }

  // Track the last research card id so we can update it with results
  const lastResearchId = useRef<string | null>(null)

  useEffect(() => {
    const stop = streamActivityFeed(projectId, cellId, tokenRef.current, (e: ActivityEvent) => {
      if (e.type === 'intent') {
        const cardType: CardType = e.data.card_type === 'maps' ? 'maps'
          : e.data.card_type === 'company' ? 'company'
          : 'web'
        // Use backend short title; fall back to first 4 words of intent
        const title = e.data.title
          || (e.data.intent || 'Research').split(' ').slice(0, 4).join(' ')
        const id = addCard(cardType, title, {
          intent: e.data.intent,
          queries: e.data.queries || [],
          results: [],
          pages: [],
        })
        lastResearchId.current = id

      } else if (e.type === 'search_done' && lastResearchId.current) {
        updateCard(lastResearchId.current, {
          data: { ...(cards.find(c => c.id === lastResearchId.current)?.data ?? {}), results: e.data.results || [] }
        })
        // Use functional update to get latest card data
        setCards(prev => prev.map(c =>
          c.id === lastResearchId.current ? { ...c, data: { ...c.data, results: e.data.results || [] } } : c
        ))

      } else if (e.type === 'sources_done') {
        const sources: CitationSource[] = e.data.sources || []
        for (const source of sources) {
          addCard('citation', source.name, source)
        }
      } else if (e.type === 'dock_window') {
        dockByHint((e.data.title_hint || '').toLowerCase(), e.data.edge)
      }
    })
    return stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, cellId])

  // Voice "dock [window name]" command — fired by ConversationPanel CDM
  useEffect(() => {
    const handler = (e: Event) => {
      const { hint, edge } = (e as CustomEvent).detail
      dockByHint(hint, edge)
    }
    window.addEventListener('dock-window', handler)
    return () => window.removeEventListener('dock-window', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "clear all windows" command
  useEffect(() => {
    const handler = () => setCards([])
    window.addEventListener('clear-canvas', handler)
    return () => window.removeEventListener('clear-canvas', handler)
  }, [])

  // "show summary" command — opens a summary card
  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent).detail
      const id = newId()
      const pos = GRID_POSITIONS[(idCounter.current - 1) % GRID_POSITIONS.length]
      setCards(prev => {
        const existing = prev.find(c => c.type === 'summary' && c.docked === null)
        if (existing) return prev.map(c => c.id === existing.id ? { ...c, data: { text } } : c)
        return [...prev, { id, type: 'summary', title: 'Conversation Summary', data: { text }, docked: null, showDockPicker: false, x: pos.x, y: pos.y }]
      })
    }
    window.addEventListener('open-summary', handler)
    return () => window.removeEventListener('open-summary', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open asset from sidebar as a canvas window
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, name, url, kind } = (e as CustomEvent).detail
      setCards(prev => {
        // Don't open duplicate undocked windows for the same asset
        if (prev.some(c => c.type === 'citation' && c.data.id === id && c.docked === null)) return prev
        const next = ++idCounter.current
        const pos = GRID_POSITIONS[(next - 1) % GRID_POSITIONS.length]
        return [...prev, { id: String(next), type: 'citation', title: name, data: { id, name, url, kind }, docked: null, showDockPicker: false, x: pos.x, y: pos.y }]
      })
    }
    window.addEventListener('open-asset', handler)
    return () => window.removeEventListener('open-asset', handler)
  }, [])

  const openCards = cards.filter(c => c.docked === null)
  const dockedLeft   = cards.filter(c => c.docked === 'left')
  const dockedRight  = cards.filter(c => c.docked === 'right')
  const dockedTop    = cards.filter(c => c.docked === 'top')
  const dockedBottom = cards.filter(c => c.docked === 'bottom')

  return (
    <div className="flex flex-col h-full bg-neutral-800">
      {/* Top docked tabs */}
      {dockedTop.length > 0 && (
        <div className="flex gap-1.5 px-3 py-1.5 border-b border-stroke flex-wrap shrink-0">
          {dockedTop.map(c => <DockedTab key={c.id} card={c} onUndock={() => undockCard(c.id)} />)}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left docked tabs */}
        {dockedLeft.length > 0 && (
          <div className="flex flex-col gap-1.5 px-1.5 py-2 border-r border-stroke shrink-0">
            {dockedLeft.map(c => <DockedTab key={c.id} card={c} onUndock={() => undockCard(c.id)} />)}
          </div>
        )}

        {/* Free canvas — cards are absolutely positioned and draggable */}
        <div
          className="flex-1 relative overflow-hidden bg-neutral-800 "
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          {openCards.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
              <svg className="w-8 h-8 opacity-10" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <p className="text-xs text-white/30 text-center max-w-[160px]">
                Windows will appear here as you ask questions
              </p>
            </div>
          )}

          {openCards.map((card, i) => (
            <div
              key={card.id}
              style={{ position: 'absolute', left: card.x, top: card.y, width: 300, zIndex: 10 + i }}
            >
              <Card
                card={card}
                loading={
                  (card.type === 'web' || card.type === 'company') &&
                  !(card.data.results?.length)
                }
                onToggleDock={() => toggleDockPicker(card.id)}
                onDock={edge => dockCard(card.id, edge)}
              >
                <CardHeader
                  title={card.title}
                  icon={cardIcon(card.type)}
                  onToggleDock={() => toggleDockPicker(card.id)}
                  onDragStart={(e) => startDrag(card.id, card.x, card.y, e)}
                />
                {card.type === 'maps'     && <MapsCard data={card.data} />}
                {card.type === 'company'  && <CompanyCard data={card.data} />}
                {card.type === 'web'      && <WebCard data={card.data} />}
                {card.type === 'citation' && <CitationCard data={card.data} />}
                {card.type === 'summary'  && <SummaryCard data={card.data} />}
              </Card>
            </div>
          ))}

          {/* Floating mic button — bottom center */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-50">
            <MicButton />
            <span className="text-[10px] text-white/30 select-none">Space</span>
          </div>
        </div>

        {/* Right docked tabs */}
        {dockedRight.length > 0 && (
          <div className="flex flex-col gap-1.5 px-1.5 py-2 border-l border-stroke shrink-0">
            {dockedRight.map(c => <DockedTab key={c.id} card={c} onUndock={() => undockCard(c.id)} />)}
          </div>
        )}
      </div>

      {/* Bottom docked tabs */}
      {dockedBottom.length > 0 && (
        <div className="flex gap-1.5 px-3 py-1.5 border-t border-stroke flex-wrap shrink-0">
          {dockedBottom.map(c => <DockedTab key={c.id} card={c} onUndock={() => undockCard(c.id)} />)}
        </div>
      )}
    </div>
  )
}
