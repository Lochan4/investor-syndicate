'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api, Activity } from '@/lib/api'

function StateChip({ state }: { state: Activity['state'] }) {
  const styles: Record<Activity['state'], { bg: string; color: string; label: string }> = {
    open:        { bg: 'rgba(141,90,43,0.10)', color: '#8D5A2B', label: 'Open' },
    in_progress: { bg: 'rgba(212,126,48,0.15)', color: '#C4611A', label: 'In progress' },
    closed:      { bg: 'rgba(34,197,94,0.12)', color: '#15803d', label: 'Closed' },
  }
  const s = styles[state]
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
      background: s.bg, color: s.color, letterSpacing: '0.03em', textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

function CompletionBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 3, borderRadius: 2, background: 'rgba(141,90,43,0.12)', marginTop: 4 }}>
      <div style={{
        height: '100%', borderRadius: 2,
        width: `${pct}%`,
        background: pct === 100 ? '#22c55e' : '#D47E30',
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

export function ActivityDrawer({
  projectId,
  token,
}: {
  projectId: string
  token: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Fetch activities when first expanded
  useEffect(() => {
    if (!expanded || activities.length > 0) return
    setLoading(true)
    api.getProjectActivities(token, projectId)
      .then(setActivities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [expanded, projectId, token, activities.length])

  // Close on outside click
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // Expose fuzzy-match function for voice selection from parent
  const openActivity = (nameHint: string) => {
    const lower = nameHint.toLowerCase()
    const match = activities.find(a =>
      a.topic.toLowerCase().includes(lower) ||
      lower.includes(a.topic.toLowerCase())
    )
    if (match) {
      router.push(`/investor/${projectId}/activities/${match.id}`)
    } else {
      setExpanded(true)
    }
  }

  // Expose openActivity via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const { name } = (e as CustomEvent).detail
      if (name) openActivity(name)
    }
    window.addEventListener('open-activity', handler)
    return () => window.removeEventListener('open-activity', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, projectId])

  return (
    <div
      ref={drawerRef}
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 60,
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 20px',
          background: '#FEFCF5',
          border: '1px solid rgba(141,90,43,0.18)',
          borderRadius: 14,
          boxShadow: '0 6px 20px rgba(141,90,43,0.18), 0 1px 4px rgba(141,90,43,0.10)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          minWidth: 160,
          justifyContent: 'space-between',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(254,252,245,0.95)')}
        onMouseLeave={e => (e.currentTarget.style.background = '#FEFCF5')}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#8D5A2B' }}>
          Activities
          {activities.length > 0 && (
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 500,
              background: 'rgba(141,90,43,0.10)', color: '#8D5A2B',
              padding: '1px 6px', borderRadius: 9999,
            }}>
              {activities.length}
            </span>
          )}
        </span>
        {/* Downward chevron — rotates when expanded */}
        <svg
          style={{
            width: 16, height: 16, color: '#8D5A2B',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 300,
          background: '#FEFCF5',
          border: '1px solid rgba(141,90,43,0.14)',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(141,90,43,0.18), 0 2px 8px rgba(141,90,43,0.10)',
          overflow: 'hidden',
          animation: 'fade-in 0.15s ease',
        }}>
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: '1px solid rgba(141,90,43,0.08)',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8D5A2B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Your Activities
            </p>
          </div>

          {loading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(141,90,43,0.5)', fontSize: 13 }}>
              Loading…
            </div>
          )}

          {!loading && activities.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(141,90,43,0.5)', fontSize: 13 }}>
              No activities yet
            </div>
          )}

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {activities.map((act, i) => (
              <button
                key={act.id}
                onClick={() => {
                  router.push(`/investor/${projectId}/activities/${act.id}`)
                  setExpanded(false)
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '12px 16px', background: 'transparent', border: 'none',
                  cursor: 'pointer', transition: 'background 0.1s',
                  borderBottom: i < activities.length - 1 ? '1px solid rgba(141,90,43,0.06)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(141,90,43,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#3D2008', flex: 1, lineHeight: 1.3 }}>
                    {act.topic}
                  </span>
                  <StateChip state={act.state} />
                </div>
                {act.description && (
                  <p style={{
                    fontSize: 11, color: 'rgba(61,32,8,0.55)', marginTop: 3,
                    lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {act.description}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(141,90,43,0.6)', fontWeight: 500 }}>
                    {act.completion_pct}% complete
                  </span>
                  {act.turn_count > 0 && (
                    <span style={{ fontSize: 10, color: 'rgba(141,90,43,0.5)' }}>
                      {act.turn_count} turn{act.turn_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <CompletionBar pct={act.completion_pct} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
