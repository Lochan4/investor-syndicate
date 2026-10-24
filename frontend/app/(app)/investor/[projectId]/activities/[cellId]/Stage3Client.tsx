'use client'
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WindowCanvas } from '@/components/WindowCanvas'
import { ConversationPanel } from '@/components/CellChat'
import { api } from '@/lib/api'

export function InvestorStage3({
  projectId,
  projectName,
  cellId,
  cellTopic,
  token,
}: {
  projectId: string
  projectName: string
  cellId: string
  cellTopic?: string
  token: string
}) {
  const router = useRouter()
  const [navActive, setNavActive] = useState(false)
  const [navHint, setNavHint] = useState<string | null>(null)
  const srRef = useRef<any>(null)
  const tokenRef = useRef(token)

  const stopNav = useCallback(() => {
    srRef.current?.abort()
    srRef.current = null
    setNavActive(false)
    setNavHint(null)
  }, [])

  const toggleNavMic = useCallback(async () => {
    if (navActive) { stopNav(); return }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const sr = new SR()
    sr.interimResults = true
    sr.continuous = true

    sr.onresult = async (e: any) => {
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ')
      const lower = transcript.toLowerCase()

      // CDM: go back to Stage 2 (this project)
      if (/\b(back|go back|return)\b/.test(lower)) {
        stopNav()
        router.push(`/investor/${projectId}`)
        return
      }

      // CDM: go to Stage 1 (all projects)
      if (/\b(projects|all projects|home)\b/.test(lower)) {
        stopNav()
        router.push('/investor')
        return
      }

      // Final result: treat as a project name — fetch and navigate
      const lastResult = (e.results as any)[e.results.length - 1]
      if (lastResult.isFinal && transcript.trim().length > 2) {
        setNavHint(`Finding "${transcript.trim()}"…`)
        try {
          const data = await api.investorStage1(tokenRef.current, transcript)
          const match = data.projects[0]
          if (match) {
            stopNav()
            router.push(`/investor/${match.id}`)
          } else {
            setNavHint('No project found — try again.')
            setTimeout(() => setNavHint('Say a project name, "go back", or "projects"'), 1800)
          }
        } catch {
          setNavHint('Could not navigate. Try again.')
        }
      }
    }

    sr.onerror = () => stopNav()
    sr.onend = () => { if (srRef.current) stopNav() }

    sr.start()
    srRef.current = sr
    setNavActive(true)
    setNavHint('Say a project name, "go back", or "projects"')
  }, [navActive, stopNav, router, projectId])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      background: 'var(--background, #FAFAF8)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid rgba(141,90,43,0.12)',
        background: '#FEFCF5',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push(`/investor/${projectId}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(141,90,43,0.55)', fontSize: 13, fontWeight: 500,
            transition: 'color 0.15s', padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#8D5A2B')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(141,90,43,0.55)')}
        >
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {projectName || 'Project'}
        </button>
        <span style={{ color: 'rgba(141,90,43,0.25)', fontSize: 13 }}>|</span>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C4611A', flex: 1 }}>
          {cellTopic || 'Activity'}
        </h2>

        {/* Navigation mic — switch project by voice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {navHint && (
            <span style={{
              fontSize: 11, color: navHint.startsWith('Finding') ? '#D47E30' : 'rgba(141,90,43,0.5)',
              fontStyle: 'italic', maxWidth: 260,
            }}>
              {navHint}
            </span>
          )}
          <button
            onClick={toggleNavMic}
            title="Switch project by voice"
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: navActive ? '#ef4444' : 'rgba(141,90,43,0.10)',
              boxShadow: navActive ? '0 0 0 6px rgba(239,68,68,0.12)' : 'none',
              transition: 'all 0.2s ease', flexShrink: 0,
            }}
          >
            <svg width={14} height={14} fill="none"
              stroke={navActive ? '#fff' : '#8D5A2B'}
              strokeWidth={1.8} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Two-column: canvas + chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, borderRight: '1px solid rgba(141,90,43,0.12)', overflow: 'hidden' }}>
          <WindowCanvas projectId={projectId} cellId={cellId} token={token} />
        </div>
        <div style={{ flexShrink: 0, overflow: 'hidden' }}>
          <ConversationPanel
            projectId={projectId}
            cellId={cellId}
            cellTopic={cellTopic}
            token={token}
          />
        </div>
      </div>
    </div>
  )
}
