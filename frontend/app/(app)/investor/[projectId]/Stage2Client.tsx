'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, Activity } from '@/lib/api'
import { LeftAssetsPanel } from '@/components/LeftAssetsPanel'
import { WindowCanvas } from '@/components/WindowCanvas'
import { ConversationPanel } from '@/components/CellChat'

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

// Top-right overlay actions bar — absolutely positioned, dropdown opens downward
function ActionsBar({
  activities,
  activeAction,
  onSelect,
  onClose,
}: {
  activities: Activity[]
  activeAction: Activity | null
  onSelect: (a: Activity) => void
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const handler = () => setExpanded(true)
    window.addEventListener('expand-actions', handler)
    return () => window.removeEventListener('expand-actions', handler)
  }, [])

  const stateColor = (state: Activity['state']) =>
    state === 'closed' ? '#22c55e' : state === 'in_progress' ? '#C4611A' : 'rgba(255,255,255,0.35)'

  return (
    <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {/* Toggle pill */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: expanded ? 'rgba(212,126,48,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${expanded ? 'rgba(212,126,48,0.35)' : 'rgba(255,255,255,0.10)'}`,
          borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
          color: expanded ? '#D47E30' : 'rgba(255,255,255,0.5)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          transition: 'all 0.15s', backdropFilter: 'blur(8px)',
        }}
      >
        <svg
          width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        Actions
        {activities.length > 0 && (
          <span style={{
            fontSize: 10, background: 'rgba(212,126,48,0.20)', color: '#D47E30',
            padding: '1px 6px', borderRadius: 9999,
          }}>
            {activities.length}
          </span>
        )}
      </button>

      {/* Active action chip */}
      {activeAction && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(212,126,48,0.10)', border: '1px solid rgba(212,126,48,0.25)',
          borderRadius: 20, padding: '5px 10px 5px 14px', backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 500, color: '#D47E30',
            maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeAction.topic}
          </span>
          <button
            onClick={onClose}
            title="Close action"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(212,126,48,0.5)', display: 'flex', alignItems: 'center', padding: 2,
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#D47E30')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(212,126,48,0.5)')}
          >
            <svg width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {expanded && (
        <div style={{
          background: '#1e1e1c', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 12, overflow: 'hidden',
          width: 280, maxHeight: 340, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}>
          {activities.length === 0 ? (
            <p style={{ padding: '20px', fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              No actions configured
            </p>
          ) : activities.map((a, i) => (
            <button
              key={a.id}
              onClick={() => { onSelect(a); setExpanded(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px', background: 'transparent', border: 'none',
                borderBottom: i < activities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,126,48,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FEFCF5', lineHeight: 1.3 }}>
                  {a.topic}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, flexShrink: 0,
                  background: `${stateColor(a.state)}20`, color: stateColor(a.state),
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {a.state === 'in_progress' ? 'active' : a.state}
                </span>
              </div>
              <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)', marginTop: 7 }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  width: `${a.completion_pct}%`,
                  background: a.completion_pct === 100 ? '#22c55e' : '#D47E30',
                }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function InvestorStage2({
  projectId,
  token,
}: {
  projectId: string
  token: string
}) {
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [activeAction, setActiveAction] = useState<Activity | null>(null)
  const [recording, setRecording] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [hint, setHint] = useState('Say an action name or "show actions" to get started')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tokenRef = useRef(token)
  const recordingRef = useRef(false)
  const lastSpaceRef = useRef(0)
  const srRef = useRef<any>(null)
  const cdmFiredRef = useRef(false)

  useEffect(() => {
    fetch('/api/token').then(r => r.ok ? r.json() : null).then(d => { if (d?.token) tokenRef.current = d.token }).catch(() => {})
    api.getProjectActivities(token, projectId).then(setActivities).catch(() => {})
  }, [token, projectId])

  // Navigation command detection — runs both on CDM partial results and full Whisper transcript
  const cdmDetect = useCallback((partial: string): boolean => {
    const lower = partial.toLowerCase()

    if (/\b(show|list|open)\b.*\b(action|activity|activities)\b/.test(lower) || /\bshow all\b/.test(lower)) {
      window.dispatchEvent(new CustomEvent('expand-actions'))
      setHint('Here are your actions.')
      setThinking(false)
      return true
    }

    if (/\b(back|return|projects|home)\b/.test(lower)) {
      router.push('/investor')
      return true
    }

    // Fuzzy match action name — word-level overlap
    const matched = activities.find(a => {
      const topic = a.topic.toLowerCase()
      return lower.includes(topic) || topic.split(' ').some(w => w.length > 3 && lower.includes(w))
    })
    if (matched) {
      setActiveAction(matched)
      setHint(`Opened: ${matched.topic}`)
      setThinking(false)
      return true
    }

    return false
  }, [activities, router])

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return
    setThinking(true)
    setHint(`"${transcript}"`)
    if (!cdmDetect(transcript)) {
      setHint('Try "show actions" or say an action name to open it.')
      setThinking(false)
    }
  }, [cdmDetect])

  const toggleMic = useCallback(async () => {
    if (recording) { mediaRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      cdmFiredRef.current = false
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        srRef.current?.abort(); srRef.current = null
        stream.getTracks().forEach(t => t.stop())
        setRecording(false); recordingRef.current = false
        if (cdmFiredRef.current) { cdmFiredRef.current = false; return }
        if (!chunksRef.current.length) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) { setThinking(false); return }
        try {
          const transcript = await api.transcribeAudio(tokenRef.current, blob)
          if (transcript) await processTranscript(transcript)
        } catch { setHint('Could not transcribe. Try again.'); setThinking(false) }
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true); recordingRef.current = true
      setHint('Listening…')

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SR) {
        const sr = new SR()
        sr.interimResults = true; sr.continuous = false
        sr.onresult = (e: any) => {
          const partial = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ')
          if (cdmDetect(partial)) { cdmFiredRef.current = true; sr.abort(); mediaRef.current?.stop() }
        }
        sr.onerror = () => {}
        sr.start(); srRef.current = sr
      }
    } catch { setHint('Microphone access denied.') }
  }, [recording, processTranscript, cdmDetect])

  // Spacebar: project-level nav mic, only when no action is active.
  // When an action IS active, ConversationPanel's own Space handler takes over.
  useEffect(() => {
    if (activeAction) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const now = Date.now()
      if (!recordingRef.current) { lastSpaceRef.current = now; toggleMic() }
      else if (now - lastSpaceRef.current < 300) { toggleMic() }
      else { lastSpaceRef.current = now }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggleMic, activeAction])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a18', display: 'flex', zIndex: 100 }}>

      {/* Left: assets panel, starts collapsed; back arrow lives here */}
      <LeftAssetsPanel projectId={projectId} token={token} initialCollapsed onBack={() => router.push('/investor')} />

      {/* Center column: canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Canvas area — fills available space, contains actions overlay */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeAction ? (
            <WindowCanvas
              key={activeAction.id}
              projectId={projectId}
              cellId={activeAction.id}
              token={token}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 24,
            }}>
              <p style={{
                fontSize: 14, textAlign: 'center',
                color: thinking ? '#D47E30' : 'rgba(255,255,255,0.2)',
                fontWeight: thinking ? 600 : 400,
                maxWidth: 380, lineHeight: 1.55, margin: 0,
                transition: 'color 0.3s ease',
              }}>
                {thinking ? 'Thinking…' : hint}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <MicButton active={recording} onClick={toggleMic} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.14)', letterSpacing: '0.06em' }}>
                  SPACE
                </span>
              </div>
            </div>
          )}

          {/* Actions overlay — top-right of canvas */}
          <ActionsBar
            activities={activities}
            activeAction={activeAction}
            onSelect={a => setActiveAction(a)}
            onClose={() => setActiveAction(null)}
          />
        </div>
      </div>

      {/* Right: chat panel — only mounted when an action is active.
          Starts collapsed (thin CHAT tab). ConversationPanel's Space handler
          takes over from the project-level mic once mounted. */}
      {activeAction && (
        <ConversationPanel
          key={activeAction.id}
          projectId={projectId}
          cellId={activeAction.id}
          cellTopic={activeAction.topic}
          token={token}
          initialCollapsed
        />
      )}
    </div>
  )
}
