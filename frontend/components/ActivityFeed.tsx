'use client'
import { useState } from 'react'
import { ActivityEvent } from '@/lib/api'

function IntentCard({ data }: { data: any }) {
  const queries: string[] = data.queries || []
  return (
    <div className="card animate-fade-in border-l-2 border-l-amber">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
        <span className="label mb-0">Intent classified</span>
      </div>
      {data.intent && (
        <p className="text-xs text-ink mb-2">{data.intent}</p>
      )}
      {queries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {queries.map((q, i) => (
            <span key={i} className="text-xs bg-amber/10 text-amber-700 px-2 py-0.5 rounded-full">{q}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchStartCard({ data }: { data: any }) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber animate-pulse shrink-0" />
        <span className="label mb-0">Searching</span>
      </div>
      <p className="text-sm text-ink mt-1.5 font-medium">{data.query}</p>
    </div>
  )
}

function SearchDoneCard({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const results: any[] = data.results || []
  const preview = expanded ? results : results.slice(0, 3)

  return (
    <div className="card animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="label mb-0">Search results</span>
        <span className="text-xs text-subtle">{results.length} found</span>
      </div>
      <div className="space-y-2">
        {preview.map((r: any, i: number) => (
          <a key={i} href={r.link} target="_blank" rel="noopener noreferrer"
            className="block group">
            <p className="text-xs font-semibold text-ink group-hover:text-amber transition-colors truncate">{r.title}</p>
            <p className="text-xs text-subtle mt-0.5 line-clamp-2">{r.snippet}</p>
          </a>
        ))}
      </div>
      {results.length > 3 && (
        <button onClick={() => setExpanded(e => !e)}
          className="btn-ghost text-xs mt-2 px-0 py-0 h-auto">
          {expanded ? 'Show less' : `+${results.length - 3} more`}
        </button>
      )}
    </div>
  )
}

function BrowserStartCard({ data }: { data: any }) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber animate-pulse shrink-0" />
        <span className="label mb-0">Opening</span>
      </div>
      <p className="text-xs text-muted mt-1 truncate">{data.url}</p>
    </div>
  )
}

function ScreenshotCard({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="label mb-0">Page captured</span>
        <a href={data.url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-muted hover:text-amber transition-colors truncate max-w-[140px]">
          {data.url?.replace(/^https?:\/\//, '')}
        </a>
      </div>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left">
        <img
          src={`data:image/jpeg;base64,${data.image}`}
          alt="Page screenshot"
          className={`w-full rounded-lg border border-stroke object-cover transition-all duration-200 ${expanded ? '' : 'max-h-36'}`}
        />
      </button>
      {!expanded && (
        <p className="text-xs text-subtle mt-1 text-center">Click to expand</p>
      )}
    </div>
  )
}

function KgStartCard({ data }: { data: any }) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber animate-pulse shrink-0" />
        <span className="label mb-0">Adding to knowledge graph</span>
      </div>
      <p className="text-xs text-muted mt-1 truncate">{data.url}</p>
    </div>
  )
}

function KgDoneCard({ data }: { data: any }) {
  return (
    <div className="card animate-fade-in border-l-2 border-l-amber">
      <span className="label mb-0">Knowledge graph updated</span>
      <p className="text-xs text-subtle mt-1">{data.chunks} chunks indexed from <span className="text-muted truncate">{data.url?.replace(/^https?:\/\//, '')}</span></p>
    </div>
  )
}

function ErrorCard({ data }: { data: any }) {
  return (
    <div className="card animate-fade-in border-l-2 border-l-red-400">
      <span className="label mb-0 text-red-500">Error</span>
      <p className="text-xs text-muted mt-1">{data.error}</p>
    </div>
  )
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="space-y-3">
      {events.map((e, i) => {
        switch (e.type) {
          case 'intent':         return <IntentCard        key={i} data={e.data} />
          case 'search_start':   return <SearchStartCard   key={i} data={e.data} />
          case 'search_done':    return <SearchDoneCard    key={i} data={e.data} />
          case 'browser_start':  return <BrowserStartCard  key={i} data={e.data} />
          case 'screenshot':     return <ScreenshotCard    key={i} data={e.data} />
          case 'kg_start':       return <KgStartCard       key={i} data={e.data} />
          case 'kg_done':        return <KgDoneCard        key={i} data={e.data} />
          case 'error':          return <ErrorCard         key={i} data={e.data} />
          default:               return null
        }
      })}
    </div>
  )
}
