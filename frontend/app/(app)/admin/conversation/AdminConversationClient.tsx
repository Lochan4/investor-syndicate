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

  useEffect(() => {
    fetch('/api/token').then(r => r.ok ? r.json() : null).then(d => { if (d?.token) tokenRef.current = d.token }).catch(() => {})
  }, [])

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return
    setThinking(true)
    setHint(`"${transcript}"`)
    try {
      const data = await api.adminStage1(tokenRef.current, transcript)
      setResult(data)
      setHint(data.message)
    } catch {
      setHint('Something went wrong. Please try again.')
    } finally {
      setThinking(false)
    }
  }, [])

  const toggleMic = useCallback(async () => {
    if (recording) {
      mediaRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        recordingRef.current = false
        if (!chunksRef.current.length) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
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
    } catch {
      setHint('Microphone access denied.')
    }
  }, [recording, processTranscript])

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

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 140, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <p style={{
          fontSize: 14,
          color: thinking ? '#D47E30' : recording ? '#ef4444' : 'rgba(255,255,255,0.35)',
          fontWeight: thinking ? 600 : 400,
          transition: 'color 0.3s ease',
          maxWidth: 500, lineHeight: 1.5,
        }}>
          {thinking ? 'Thinking…' : hint}
        </p>
      </div>

      {/* Mic */}
      <div style={{
        position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <MicButton active={recording} onClick={toggleMic} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)', letterSpacing: '0.06em' }}>SPACE</span>
      </div>
    </div>
  )
}
