'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { api, streamAnswer, CitationSource } from '@/lib/api'
import { Icons } from './Icons'

interface Message { role: 'user' | 'assistant'; content: string; sources?: CitationSource[] }

export function ConversationPanel({ projectId, cellId, cellTopic, token }: {
  projectId: string; cellId: string; cellTopic?: string; token: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [submitDone, setSubmitDone] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const [recording, setRecording] = useState(false)
  // Confidence prompt
  const [showConfidence, setShowConfidence] = useState(false)
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null)
  const [confidenceSaved, setConfidenceSaved] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingRef = useRef(false)
  const lastSpaceRef = useRef(0)
  const toggleMicRef = useRef<(() => void) | null>(null)
  const tokenRef = useRef(token)

  // Keep token fresh — WorkOS access tokens expire in ~5 min
  useEffect(() => {
    fetch('/api/token').then(r => r.ok ? r.json() : null).then(d => { if (d?.token) tokenRef.current = d.token }).catch(() => {})
  }, [])

  useEffect(() => {
    api.getOrCreateSession(tokenRef.current, projectId, cellId)
      .then(s => setSessionId(s.session_id))
      .catch(() => setSessionError(true))
  }, [token, projectId, cellId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, thinking])

  useEffect(() => { recordingRef.current = recording }, [recording])

  // Show confidence prompt after 5 user messages
  useEffect(() => {
    const userCount = messages.filter(m => m.role === 'user').length
    if (userCount >= 5 && !confidenceSaved && !showConfidence) setShowConfidence(true)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  // spacebar: single press → start mic, double press within 300ms → stop mic
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (document.activeElement === inputRef.current) return
      e.preventDefault()
      const now = Date.now()
      if (!recordingRef.current) {
        lastSpaceRef.current = now
        toggleMicRef.current?.()
      } else if (now - lastSpaceRef.current < 300) {
        toggleMicRef.current?.()
      } else {
        lastSpaceRef.current = now
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || !sessionId || thinking) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setThinking(true)
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    try {
      const d = await fetch('/api/token').then(r => r.ok ? r.json() : null)
      if (d?.token) tokenRef.current = d.token
    } catch {}

    try {
      streamAnswer(
        projectId, sessionId, msg, cellId, tokenRef.current,
        (tok) => setMessages(m => {
          const updated = [...m]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + tok }
          return updated
        }),
        (sources) => {
          setThinking(false)
          setMessages(m => {
            const updated = [...m]
            updated[updated.length - 1] = { ...updated[updated.length - 1], sources }
            return updated
          })
          inputRef.current?.focus()
        },
        undefined,
        (errMsg) => {
          setThinking(false)
          setMessages(m => {
            const updated = [...m]
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${errMsg}` }
            return updated
          })
        },
      )
    } catch {
      setThinking(false)
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
        return updated
      })
    }
  }, [input, sessionId, thinking, projectId, cellId])

  const submit = async () => {
    if (!sessionId) return
    try {
      await api.submitSession(tokenRef.current, projectId, sessionId)
      setSubmitDone(true)
      setTimeout(() => setSubmitDone(false), 3000)
    } catch {}
  }

  const saveConfidence = async (score: number) => {
    setConfidenceScore(score)
    if (!sessionId) return
    try {
      await api.setConfidenceScore(tokenRef.current, projectId, sessionId, cellId, score)
      setConfidenceSaved(true)
      setTimeout(() => setShowConfidence(false), 1200)
    } catch {}
  }

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
        if (!sessionId || !chunksRef.current.length) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        try {
          const transcript = await api.sendVoice(tokenRef.current, projectId, sessionId, blob)
          if (transcript) send(transcript)
        } catch {}
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {}
  }, [recording, sessionId, projectId, send])
  useEffect(() => { toggleMicRef.current = toggleMic }, [toggleMic])

  if (sessionError) return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Failed to load session. Refresh to try again.
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted py-16">
            <div className="w-12 h-12 rounded-full bg-stroke flex items-center justify-center">
              <Icons.Chat />
            </div>
            <div className="text-center">
              <div className="font-semibold text-amber-600 text-sm">{cellTopic || 'Cell Discussion'}</div>
              <div className="text-xs mt-1 text-subtle">Ask anything about this topic</div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[72%] rounded-2xl px-4 py-3 ${
              m.role === 'user'
                ? 'bg-amber text-white rounded-br-sm'
                : 'bg-surface border border-stroke text-ink rounded-bl-sm shadow-card'
            }`}>
              {m.role === 'assistant' && thinking && i === messages.length - 1 && !m.content ? (
                <div className="flex items-center gap-2 text-xs text-muted py-0.5">
                  <div className="flex gap-1">
                    {[0,1,2].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-muted rounded-full"
                        style={{ animation: `pulse-dot 1.2s ${d * 0.2}s infinite` }} />
                    ))}
                  </div>
                  <span>Thinking…</span>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-current/10 flex flex-wrap gap-1">
                  {m.sources.map(s => (
                    <a
                      key={s.id}
                      href={s.url ?? `/projects/${projectId}/assets`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs bg-current/10 px-2 py-0.5 rounded-md hover:bg-current/20 transition-colors"
                    >
                      <Icons.File />
                      <span className="max-w-[120px] truncate">{s.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Confidence prompt — shown after 5 messages */}
      {showConfidence && !submitted && (
        <div className="border-t border-stroke px-4 py-3" style={{ background: 'rgba(141,90,43,0.04)' }}>
          {confidenceSaved ? (
            <p className="text-xs text-center text-green-700 font-medium py-1">
              ✓ Confidence saved — thank you
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-ink mb-2">
                How confident are you in your analysis of <span className="text-amber-600">{cellTopic || 'this topic'}</span>?
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted mr-1">Low</span>
                {[1,2,3,4,5,6,7,8,9,10].map(s => (
                  <button
                    key={s}
                    onClick={() => saveConfidence(s)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      confidenceScore === s
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-surface border border-stroke text-ink hover:border-amber-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <span className="text-xs text-muted ml-1">High</span>
                <button onClick={() => setShowConfidence(false)} className="ml-auto text-xs text-muted hover:text-ink">
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="border-t border-stroke p-4 bg-surface">
        {submitDone && (
          <div className="flex items-center justify-center gap-2 py-1.5 mb-3 text-sm text-green-700 bg-green-50 rounded-xl">
            <Icons.Check /> Response submitted — thank you
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={recording ? 'Recording…' : 'Ask about this topic…'}
            disabled={thinking || recording}
            className="input flex-1"
          />
          <button onClick={toggleMic} disabled={thinking}
            className={`w-10 flex items-center justify-center rounded-lg transition-all duration-150 ${
              recording
                ? 'bg-red-500 text-white animate-pulse'
                : 'btn-ghost border border-stroke'
            }`}>
            <Icons.Mic />
          </button>
          <button onClick={() => send()} disabled={!input.trim() || thinking || recording}
            className="btn-primary w-10 flex items-center justify-center">
            <Icons.Send />
          </button>
          <button onClick={submit} className="btn-secondary px-3 flex items-center gap-1.5 text-xs">
            <Icons.Check /> Submit
          </button>
        </div>
      </div>
    </div>
  )
}

/** @deprecated use ConversationPanel */
export const CellChat = ConversationPanel
