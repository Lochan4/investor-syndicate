'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, AdminStage1Response } from '@/lib/api'

type ResultData = AdminStage1Response | null

function MicButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Click or press Space to speak"
      style={{
        width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#ef4444' : '#D47E30',
        boxShadow: active
          ? '0 0 0 12px rgba(239,68,68,0.15), 0 8px 32px rgba(239,68,68,0.35)'
          : '0 8px 32px rgba(212,126,48,0.45)',
        transform: active ? 'scale(1.08)' : 'scale(1)',
        transition: 'all 0.2s ease',
      }}
    >
      <svg width={28} height={28} fill="none" stroke="#fff" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'submitted' || status === 'reviewing' ? '#D47E30'
    : status === 'added' ? '#22c55e'
    : status === 'rejected' ? '#ef4444'
    : '#8D5A2B'
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999,
      background: `${color}18`, color,
    }}>
      {status}
    </span>
  )
}

export function AdminConversationCanvas({ token }: { token: string }) {
  const router = useRouter()
  const [recording, setRecording] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<ResultData>(null)
  const [hint, setHint] = useState('Ask anything — "Show me all applications", "How many workspaces are there?"')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tokenRef = useRef(token)
  const recordingRef = useRef(false)
  const lastSpaceRef = useRef(0)
  const srRef = useRef<any>(null)
  const cdmFiredRef = useRef(false)

  useEffect(() => {
    fetch('/api/token').then(r => r.ok ? r.json() : null).then(d => { if (d?.token) tokenRef.current = d.token }).catch(() => {})
  }, [])

  const matchItem = useCallback((text: string) => {
    if (!result) return null
    const lower = text.toLowerCase()
    const matchName = (name: string) => {
      const n = name.toLowerCase()
      return lower.includes(n) || n.includes(lower) || n.split(' ').some(w => w.length > 2 && lower.includes(w))
    }
    const proj = result.projects.find(p => matchName(p.startup_name))
    if (proj) return { type: 'project', id: proj.id } as const
    const app = result.applications.find(a => matchName(a.startup_name))
    if (app) return { type: 'application', id: app.id } as const
    return null
  }, [result])

  // CDM-classify: pattern-match simple filter words client-side.
  // Used as a guardrail: if Jev returns "all" but CDM knows better, filter the display.
  const cdmClassify = (text: string): string | null => {
    const t = text.toLowerCase()
    if (/\b(open|go to|navigate)\b/.test(t)) return null  // navigation → Jev resolves name→ID
    if (/\b(application|applications|applicants)\b/.test(t)) {
      return /\b(pending|reviewing|under review)\b/.test(t) ? 'pending_applications' : 'applications'
    }
    if (/\b(workspace|workspaces)\b/.test(t)) return 'workspaces'
    if (/\b(project|projects)\b/.test(t)) return 'projects'
    return null
  }

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return
    setThinking(true)
    setHint(`"${transcript}"`)

    // Layer 1 — CDM name match: instant navigation from already-loaded results
    if (result) {
      const matched = matchItem(transcript)
      if (matched) {
        router.push(matched.type === 'project' ? `/investor/${matched.id}` : `/admin/inbox/${matched.id}`)
        return
      }
    }

    // Layer 2 — Jev: backend classifies intent + fetches data
    try {
      const data = await api.adminStage1(tokenRef.current, transcript)
      if (data.intent === 'navigate' && (data as any).route) {
        router.push((data as any).route)
        return
      }

      // Layer 3 — CDM guardrail: if Jev returned "all" but we can pattern-match a specific intent,
      // filter the response so only the relevant section is shown
      const localIntent = cdmClassify(transcript)
      if (localIntent && data.intent === 'all') {
        const filtered = { ...data }
        if (localIntent !== 'applications' && localIntent !== 'pending_applications') filtered.applications = []
        if (localIntent !== 'workspaces') filtered.workspaces = []
        if (localIntent !== 'projects') filtered.projects = []
        if (localIntent === 'pending_applications') {
          filtered.applications = filtered.applications.filter(
            (a: any) => a.status === 'submitted' || a.status === 'reviewing'
          )
        }
        setResult(filtered)
        setHint(data.message)
      } else {
        setResult(data)
        setHint(data.message)
      }
    } catch {
      setHint('Something went wrong. Please try again.')
    } finally {
      setThinking(false)
    }
  }, [result, router, matchItem]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = useCallback(async () => {
    if (recording) {
      mediaRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      cdmFiredRef.current = false
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        srRef.current?.abort()
        srRef.current = null
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        recordingRef.current = false
        if (cdmFiredRef.current) { cdmFiredRef.current = false; return }
        if (!chunksRef.current.length) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return
        try {
          const transcript = await api.transcribeAudio(tokenRef.current, blob)
          if (transcript) await processTranscript(transcript)
        } catch {
          setHint('Could not transcribe. Try again.')
          setThinking(false)
        }
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
      recordingRef.current = true
      setHint('Listening…')

      // CDM: partial transcript detection — fires before Whisper completes
      if (result) {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (SR) {
          const sr = new SR()
          sr.interimResults = true
          sr.continuous = false
          sr.onresult = (e: any) => {
            const partial = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ')
            const matched = matchItem(partial)
            if (matched) {
              cdmFiredRef.current = true
              sr.abort()
              mediaRef.current?.stop()
              router.push(matched.type === 'project' ? `/projects/${matched.id}` : `/admin/inbox/${matched.id}`)
            }
          }
          sr.onerror = () => {}
          sr.start()
          srRef.current = sr
        }
      }
    } catch {
      setHint('Microphone access denied.')
    }
  }, [recording, processTranscript, result, matchItem, router])

  // Spacebar shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const now = Date.now()
      if (!recordingRef.current) {
        lastSpaceRef.current = now
        toggleMic()
      } else if (now - lastSpaceRef.current < 300) {
        toggleMic()
      } else {
        lastSpaceRef.current = now
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggleMic])

  const hasResults = result && (
    result.applications.length > 0 || result.workspaces.length > 0 || result.projects.length > 0
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#1a1a18',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Results */}
      {hasResults && (
        <div style={{
          position: 'absolute', inset: 0,
          padding: '90px 48px 160px',
          overflowY: 'auto',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: 960 }}>

            {result!.applications.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(254,252,245,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Applications
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {result!.applications.map(a => (
                    <button
                      key={a.id}
                      onClick={() => router.push(`/admin/inbox/${a.id}`)}
                      style={{
                        textAlign: 'left', padding: '16px 18px',
                        background: 'rgba(254,252,245,0.05)',
                        border: '1px solid rgba(254,252,245,0.10)',
                        borderRadius: 14, cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(212,126,48,0.10)'
                        e.currentTarget.style.borderColor = 'rgba(212,126,48,0.25)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(254,252,245,0.05)'
                        e.currentTarget.style.borderColor = 'rgba(254,252,245,0.10)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#FEFCF5' }}>{a.startup_name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(254,252,245,0.45)', marginTop: 2 }}>{a.founder_name}</div>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.sector && (
                        <div style={{ fontSize: 11, color: 'rgba(254,252,245,0.35)', marginTop: 6 }}>{a.sector}</div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {result!.projects.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(254,252,245,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Projects
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {result!.projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      style={{
                        textAlign: 'left', padding: '14px 16px',
                        background: 'rgba(254,252,245,0.04)',
                        border: '1px solid rgba(254,252,245,0.08)',
                        borderRadius: 12, cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(212,126,48,0.08)'
                        e.currentTarget.style.borderColor = 'rgba(212,126,48,0.2)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(254,252,245,0.04)'
                        e.currentTarget.style.borderColor = 'rgba(254,252,245,0.08)'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#FEFCF5' }}>{p.startup_name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {p.sector && (
                          <span style={{ fontSize: 10, color: 'rgba(254,252,245,0.4)' }}>{p.sector}</span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: p.status === 'open' ? '#22c55e' : 'rgba(254,252,245,0.3)',
                        }}>
                          {p.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {result!.workspaces.length > 0 && (
              <section>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(254,252,245,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Workspaces
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {result!.workspaces.map(w => (
                    <div
                      key={w.id}
                      style={{
                        padding: '14px 16px',
                        background: 'rgba(254,252,245,0.04)',
                        border: '1px solid rgba(254,252,245,0.08)',
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#FEFCF5' }}>{w.name}</div>
                      {w.description && (
                        <div style={{ fontSize: 11, color: 'rgba(254,252,245,0.4)', marginTop: 3 }}>{w.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Hint + Mic — stacked so text never overlaps the button */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        pointerEvents: 'none',
      }}>
        <p style={{
          fontSize: 14, textAlign: 'center',
          color: thinking ? '#D47E30' : recording ? '#ef4444' : 'rgba(255,255,255,0.35)',
          fontWeight: thinking ? 600 : 400,
          transition: 'color 0.3s ease',
          maxWidth: 500, lineHeight: 1.5, margin: 0,
        }}>
          {thinking ? 'Thinking…' : hint}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <MicButton active={recording} onClick={toggleMic} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)', letterSpacing: '0.06em' }}>SPACE</span>
        </div>
      </div>
    </div>
  )
}
