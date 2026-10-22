'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { ActivityDrawer } from '@/components/ActivityDrawer'

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

export function InvestorStage2({
  projectId,
  projectName,
  token,
}: {
  projectId: string
  projectName: string
  token: string
}) {
  const router = useRouter()
  const [recording, setRecording] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [hint, setHint] = useState('Say "show activities" or ask anything about this project.')
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

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return
    setThinking(true)
    setHint(`"${transcript}"`)

    // CDM already handles show_activities and go_back via Web Speech API partial results.
    // Whisper path: anything that reached here is a query for a named activity.
    window.dispatchEvent(new CustomEvent('open-activity', { detail: { name: transcript } }))
    setHint('Looking for that activity…')
    setThinking(false)
  }, [])

  // CDM command detector — fires on Web Speech API partial results before Whisper completes
  const cdmDetect = useCallback((partial: string): boolean => {
    const lower = partial.toLowerCase()
    if (/\b(activities|activity|show activities|list activities)\b/.test(lower)) {
      window.dispatchEvent(new CustomEvent('open-activity', { detail: { name: '' } }))
      setHint('Here are your activities.')
      setThinking(false)
      return true
    }
    if (/\b(back|go back|return|projects)\b/.test(lower)) {
      router.push('/investor')
      return true
    }
    return false
  }, [router])

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

      // CDM: partial transcript detection for navigation commands
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SR) {
        const sr = new SR()
        sr.interimResults = true
        sr.continuous = false
        sr.onresult = (e: any) => {
          const partial = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ')
          if (cdmDetect(partial)) {
            cdmFiredRef.current = true
            sr.abort()
            mediaRef.current?.stop()
          }
        }
        sr.onerror = () => {}
        sr.start()
        srRef.current = sr
      }
    } catch {
      setHint('Microphone access denied.')
    }
  }, [recording, processTranscript, cdmDetect])

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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#1a1a18',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Back to Stage 1 */}
      <button
        onClick={() => router.push('/investor')}
        style={{
          position: 'absolute', top: 20, left: 20, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(254,252,245,0.35)', fontSize: 13, fontWeight: 500,
          transition: 'color 0.15s',
          padding: '8px 4px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(254,252,245,0.7)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(254,252,245,0.35)')}
      >
        <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Projects
      </button>

      {/* Project name */}
      <div style={{
        position: 'absolute', top: 22,
        left: '50%', transform: 'translateX(-50%)',
        fontSize: 14, fontWeight: 600, color: 'rgba(254,252,245,0.55)',
        letterSpacing: '0.02em',
      }}>
        {projectName}
      </div>

      {/* Activity drawer — top right */}
      <ActivityDrawer projectId={projectId} token={token} />

      {/* Hint text */}
      <div style={{
        position: 'absolute', bottom: 140, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <p style={{
          fontSize: 14, color: thinking ? '#D47E30' : recording ? '#ef4444' : 'rgba(255,255,255,0.35)',
          fontWeight: thinking ? 600 : 400,
          transition: 'color 0.3s ease',
          maxWidth: 420, lineHeight: 1.5,
        }}>
          {thinking ? 'Thinking…' : hint}
        </p>
      </div>

      {/* Centered mic */}
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
