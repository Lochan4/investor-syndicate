'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, Stage1Project, Stage1Workspace } from '@/lib/api'

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
        animation: active ? 'pulse-ring 1.4s ease-in-out infinite' : 'none',
      }}
    >
      <svg width={28} height={28} fill="none" stroke="#fff" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  )
}

type ResultState = { projects: Stage1Project[]; workspaces: Stage1Workspace[]; message: string } | null

export function InvestorStage1({ token }: { token: string }) {
  const router = useRouter()
  const [recording, setRecording] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<ResultState>(null)
  const [hint, setHint] = useState('Say something like "What projects am I part of?"')
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

  const matchProject = useCallback((text: string, projects: Stage1Project[]) => {
    const lower = text.toLowerCase()
    return projects.find(p => {
      const name = p.startup_name.toLowerCase()
      return lower.includes(name) || name.includes(lower) ||
        name.split(' ').some(w => w.length > 2 && lower.includes(w))
    })
  }, [])

  const cdmClassify = (text: string): string | null => {
    const t = text.toLowerCase()
    if (/\b(open|go to|navigate)\b/.test(t)) return null
    if (/\b(active|open)\b/.test(t) && /\b(project|projects)\b/.test(t)) return 'active'
    if (/\b(project|projects)\b/.test(t)) return 'projects'
    if (/\b(workspace|workspaces)\b/.test(t)) return 'workspaces'
    return null
  }

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return
    setThinking(true)
    setHint(`"${transcript}"`)

    // If results are showing, first try local name match before hitting the API
    if (result?.projects.length) {
      const matched = matchProject(transcript, result.projects)
      if (matched) {
        router.push(`/investor/${matched.id}`)
        return
      }
    }

    // Call stage1 — handles both queries and navigation intents via Jev
    try {
      const data = await api.investorStage1(tokenRef.current, transcript)

      // Backend resolved the navigation target to a route — use it directly
      if (data.intent === 'navigate' && (data as any).route) {
        router.push((data as any).route)
        return
      }

      // CDM guardrail: if Jev returned "all" but we can pattern-match a specific intent,
      // filter so only the relevant section is shown
      const localIntent = cdmClassify(transcript)
      if (localIntent && data.intent === 'all') {
        const filtered = { ...data }
        if (localIntent !== 'projects' && localIntent !== 'active' && localIntent !== 'assigned') filtered.projects = []
        if (localIntent !== 'workspaces') filtered.workspaces = []
        setResult({ projects: filtered.projects, workspaces: filtered.workspaces, message: data.message })
      } else {
        setResult({ projects: data.projects, workspaces: data.workspaces, message: data.message })
      }
      setHint(data.message)
    } catch {
      setHint('Something went wrong. Please try again.')
    } finally {
      setThinking(false)
    }
  }, [result, router, matchProject])

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
        if (blob.size < 1000) { setThinking(false); return }  // too short, skip Whisper
        try {
          const transcript = await api.transcribeAudio(tokenRef.current, blob)
          if (transcript) await processTranscript(transcript)
        } catch {
          setHint('Could not transcribe audio. Try again.')
          setThinking(false)
        }
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
      recordingRef.current = true
      setHint('Listening…')

      // CDM: Web Speech API for real-time command detection (fires before Whisper completes)
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SR && result) {
        const sr = new SR()
        sr.interimResults = true
        sr.continuous = false
        sr.onresult = (e: any) => {
          const partial = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ')
          const lower = partial.toLowerCase()
          const matched = result.projects.find((p: Stage1Project) =>
            lower.includes(p.startup_name.toLowerCase()) ||
            p.startup_name.toLowerCase().split(' ').some((w: string) => w.length > 3 && lower.includes(w))
          )
          if (matched) {
            cdmFiredRef.current = true
            sr.abort()
            mediaRef.current?.stop()
            router.push(`/investor/${matched.id}`)
          }
        }
        sr.onerror = () => {}
        sr.start()
        srRef.current = sr
      }
    } catch {
      setHint('Microphone access denied.')
    }
  }, [recording, processTranscript, result, router])

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

  const statusColor = thinking ? '#D47E30' : recording ? '#ef4444' : 'rgba(255,255,255,0.35)'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#1a1a18',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Results grid */}
      {result && (result.projects.length > 0 || result.workspaces.length > 0) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '120px 48px 160px',
          overflowY: 'auto',
        }}>
          <div style={{ width: '100%', maxWidth: 900 }}>
            {result.projects.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(254,252,245,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Projects
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 32 }}>
                  {result.projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/investor/${p.id}`)}
                      style={{
                        textAlign: 'left', padding: '18px 20px',
                        background: 'rgba(254,252,245,0.05)',
                        border: '1px solid rgba(254,252,245,0.10)',
                        borderRadius: 16, cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(212,126,48,0.12)'
                        e.currentTarget.style.borderColor = 'rgba(212,126,48,0.3)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(254,252,245,0.05)'
                        e.currentTarget.style.borderColor = 'rgba(254,252,245,0.10)'
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#FEFCF5', marginBottom: 6 }}>
                        {p.startup_name}
                      </div>
                      {p.sector && (
                        <div style={{ fontSize: 11, color: 'rgba(254,252,245,0.45)', marginBottom: 4 }}>{p.sector}</div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {p.stage && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(212,126,48,0.15)', color: '#D47E30', fontWeight: 600 }}>
                            {p.stage}
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 9999, fontWeight: 600,
                          background: p.status === 'open' ? 'rgba(34,197,94,0.12)' : 'rgba(254,252,245,0.08)',
                          color: p.status === 'open' ? '#22c55e' : 'rgba(254,252,245,0.4)',
                        }}>
                          {p.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {result.workspaces.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(254,252,245,0.22)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, marginTop: result.projects.length > 0 ? 8 : 0 }}>
                  Workspaces
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {result.workspaces.map(w => (
                    <div
                      key={w.id}
                      style={{
                        padding: '7px 14px',
                        background: 'rgba(254,252,245,0.03)',
                        border: '1px solid rgba(254,252,245,0.06)',
                        borderRadius: 20,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(254,252,245,0.45)' }}>{w.name}</span>
                    </div>
                  ))}
                </div>
              </>
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
          fontSize: 14, textAlign: 'center', color: statusColor,
          fontWeight: thinking ? 600 : 400,
          transition: 'color 0.3s ease',
          maxWidth: 420, lineHeight: 1.5, margin: 0,
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
