'use client'
import { useEffect, useRef, useState } from 'react'
import { api, Characteristic, PolicyDoc, TemplateCellInput, TemplateVersion } from '@/lib/api'

function StepSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', height: 28 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#D9C4A8', borderRadius: 1 }} />
      <div style={{
        position: 'absolute', left: 0, height: 2, borderRadius: 1,
        background: '#D47E30',
        width: `${((value - 1) / 9) * 100}%`,
        transition: 'width 0.15s ease',
      }} />
      {steps.map(step => {
        const active = step === value
        const pct = ((step - 1) / 9) * 100
        return (
          <button key={step} type="button" onClick={() => onChange(step)} style={{
            position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
            width: active ? 18 : 8, height: active ? 18 : 8,
            borderRadius: '50%', background: active ? '#D47E30' : '#C4A882',
            border: active ? '2px solid #B86A20' : 'none',
            transition: 'all 0.15s ease', cursor: 'pointer', padding: 0, zIndex: 1,
          }} />
        )
      })}
    </div>
  )
}

interface Props { token: string; versions: TemplateVersion[]; initialCells?: TemplateCellInput[] }

interface CellState extends TemplateCellInput {
  _mode: 'prompt' | 'characteristics'
  _extracting: boolean
}

const emptyCell = (order: number): CellState => ({
  topic: '', prompt: '', position_x: 0, position_y: 0, cell_order: order,
  characteristics: [], policy_doc_ids: [],
  _mode: 'prompt', _extracting: false,
})

const toChars = (v: any): Characteristic[] => {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { return JSON.parse(v) } catch {} }
  return []
}

const toCell = (c: TemplateCellInput): CellState => {
  const characteristics = toChars(c.characteristics)
  return {
    ...c,
    characteristics,
    policy_doc_ids: Array.isArray(c.policy_doc_ids) ? c.policy_doc_ids : [],
    _mode: characteristics.length > 0 ? 'characteristics' : 'prompt',
    _extracting: false,
  }
}

// ── Policy Doc Modal ────────────────────────────────────────────────────────
function PolicyDocModal({
  docs,
  selectedIds,
  onToggle,
  onClose,
}: {
  docs: PolicyDoc[]
  selectedIds: string[]
  onToggle: (docId: string) => void
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FEFCF5',
          borderRadius: 16,
          border: '1px solid rgba(141,90,43,0.18)',
          boxShadow: '0 20px 60px rgba(141,90,43,0.22)',
          padding: 24,
          width: 420,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#825E34' }}>Attach Policy Documents</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8D5A2B', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {docs.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(141,90,43,0.5)', margin: 0 }}>
            No policy documents yet. Upload a PDF in the Policy Documents section above.
          </p>
        ) : (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => {
              const selected = selectedIds.includes(doc.id)
              return (
                <button
                  key={doc.id}
                  onClick={() => onToggle(doc.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${selected ? '#D47E30' : 'rgba(141,90,43,0.2)'}`,
                    background: selected ? 'rgba(212,126,48,0.08)' : 'white',
                    transition: 'all 0.15s ease', textAlign: 'left',
                  }}
                >
                  {/* checkbox */}
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${selected ? '#D47E30' : 'rgba(141,90,43,0.3)'}`,
                    background: selected ? '#D47E30' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}>
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span style={{ fontSize: 13, color: '#825E34', fontWeight: selected ? 600 : 400 }}>
                    {doc.filename}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 18, padding: '9px 0', borderRadius: 8,
            background: '#D47E30', color: '#FEFCF5',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ── Main Editor ─────────────────────────────────────────────────────────────
export function TemplateEditor({ token, versions: initialVersions, initialCells }: Props) {
  const [cells, setCells] = useState<CellState[]>(
    initialCells && initialCells.length > 0 ? initialCells.map(toCell) : [emptyCell(0)]
  )
  const [versions, setVersions] = useState(initialVersions)
  const [policyDocs, setPolicyDocs] = useState<PolicyDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null)
  const [recordingCell, setRecordingCell] = useState<number | null>(null)
  const [docModalCell, setDocModalCell] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    api.listPolicyDocs(token).then(setPolicyDocs).catch(() => {})
  }, [token])

  const updateCell = (i: number, patch: Partial<CellState>) =>
    setCells(c => c.map((cell, idx) => idx === i ? { ...cell, ...patch } : cell))

  const addCell = () => setCells(c => [...c, emptyCell(c.length)])
  const removeCell = (i: number) => setCells(c => c.filter((_, idx) => idx !== i))

  // Toggle a policy doc on a cell — update local state + persist if cell has a DB id
  const toggleDoc = (cellIdx: number, docId: string) => {
    setCells(prev => {
      const cell = prev[cellIdx]
      const next = cell.policy_doc_ids.includes(docId)
        ? cell.policy_doc_ids.filter(id => id !== docId)
        : [...cell.policy_doc_ids, docId]
      const updated = prev.map((c, i) => i === cellIdx ? { ...c, policy_doc_ids: next } : c)
      // Persist immediately if this cell already exists in DB
      if (cell.id) {
        api.updateCellPolicyDocs(token, cell.id, next).catch(() => {})
      }
      return updated
    })
  }

  const uploadDoc = async (file: File) => {
    setUploading(true); setError('')
    try {
      const { upload_url, storage_key, content_type } = await api.getPolicyDocUploadUrl(token, file.name)
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': content_type } })
      const doc = await api.confirmPolicyDoc(token, file.name, storage_key)
      setPolicyDocs(d => [doc, ...d])
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const extractCharacteristics = async (i: number) => {
    const cell = cells[i]
    if (!cell.prompt.trim()) return
    updateCell(i, { _extracting: true })
    try {
      const result = await api.extractCharacteristics(token, cell.prompt, cell.policy_doc_ids)
      updateCell(i, { topic: result.topic, characteristics: result.characteristics, _mode: 'characteristics', _extracting: false })
    } catch (e: any) {
      setError(e.message || 'Extraction failed')
      updateCell(i, { _extracting: false })
    }
  }

  const updateStrength = (cellIdx: number, charIdx: number, strength: number) =>
    setCells(c => c.map((cell, i) => i !== cellIdx ? cell : {
      ...cell,
      characteristics: cell.characteristics.map((ch, j) => j === charIdx ? { ...ch, strength } : ch),
    }))

  const loadVersion = async (versionId: string) => {
    setLoadingVersion(versionId); setError('')
    try {
      const loaded = await api.getTemplateCells(token, versionId)
      setCells(loaded.map(toCell))
    } catch (e: any) {
      setError(e.message || 'Failed to load version')
    } finally {
      setLoadingVersion(null)
    }
  }

  const promoteVersion = async (versionId: string) => {
    setError('')
    try {
      await api.promoteVersion(token, versionId)
      const updated = await api.listTemplateVersions(token)
      setVersions(updated)
    } catch (e: any) {
      setError(e.message || 'Failed to promote version')
    }
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecordingCell(null)
  }

  const toggleVoice = (i: number) => {
    if (recordingCell === i) { stopVoice(); return }
    stopVoice()
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setError('Speech recognition not supported in this browser'); return }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const transcript = e.results[e.resultIndex][0].transcript
      setCells(c => c.map((cell, idx) => idx !== i ? cell : {
        ...cell, prompt: cell.prompt + (cell.prompt ? ' ' : '') + transcript.trim(),
      }))
    }
    rec.onerror = () => stopVoice()
    rec.onend = () => setRecordingCell(null)
    rec.start()
    recognitionRef.current = rec
    setRecordingCell(i)
  }

  const publish = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const payload: TemplateCellInput[] = cells.map((c, i) => ({
        topic: c.topic, prompt: c.prompt,
        position_x: c.position_x, position_y: c.position_y, cell_order: i,
        characteristics: c.characteristics, policy_doc_ids: c.policy_doc_ids,
      }))
      await api.publishTemplate(token, payload)
      const updated = await api.listTemplateVersions(token)
      setVersions(updated)
      setSaved(true)
    } catch (e: any) {
      setError(e.message || 'Failed to publish')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      {/* Policy doc modal */}
      {docModalCell !== null && (
        <PolicyDocModal
          docs={policyDocs}
          selectedIds={cells[docModalCell]?.policy_doc_ids ?? []}
          onToggle={docId => toggleDoc(docModalCell, docId)}
          onClose={() => setDocModalCell(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#825E34]">Flow Canvas Editor</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-700">✓ Published</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
          <button onClick={() => setCells([emptyCell(0)])}
            className="px-4 py-2 border border-[#8D5A2B]/50 text-[#8D5A2B] rounded-lg text-sm hover:bg-[#8D5A2B]/10 transition-all duration-200">
            New Canvas
          </button>
          <button onClick={addCell}
            className="px-4 py-2 border border-[#8D5A2B] text-[#825E34] rounded-lg text-sm hover:bg-[#8D5A2B]/10 transition-all duration-200">
            + Add Cell
          </button>
          <button onClick={publish} disabled={saving}
            className="px-4 py-2 bg-[#D47E30] text-[#FDFBD4] rounded-lg text-sm font-medium hover:bg-[#B86A20] disabled:opacity-50 transition-all duration-200">
            {saving ? 'Publishing…' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Canvas Library */}
      {versions.length > 0 && (
        <div className="mb-6 bg-white/60 border border-[#8D5A2B]/30 rounded-xl p-4">
          <span className="text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Canvas Library</span>
          <p className="text-xs text-[#8D5A2B]/60 mt-1 mb-3">Load an existing canvas to edit its cells and prompt.</p>
          <div className="flex flex-wrap gap-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center gap-1 border border-[#8D5A2B]/40 rounded-lg overflow-hidden">
                <button onClick={() => loadVersion(v.id)} disabled={loadingVersion === v.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#825E34] hover:bg-[#8D5A2B]/10 transition-all duration-150 disabled:opacity-50">
                  {loadingVersion === v.id ? 'Loading…' : `v${v.version_num}`}
                </button>
                {v.status === 'live' ? (
                  <span className="px-1.5 py-0.5 mr-1.5 rounded text-[10px] font-medium bg-green-100 text-green-700">live</span>
                ) : (
                  <button onClick={() => promoteVersion(v.id)}
                    className="px-1.5 py-0.5 mr-1.5 rounded text-[10px] font-medium bg-[#8D5A2B]/15 text-[#8D5A2B] hover:bg-[#D47E30] hover:text-white transition-all duration-150"
                    title="Set as live">
                    archived
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy doc library */}
      <div className="mb-8 bg-white/60 border border-[#8D5A2B]/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Policy Documents</span>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-xs px-3 py-1.5 border border-[#8D5A2B]/40 text-[#825E34] rounded-lg hover:bg-[#8D5A2B]/10 disabled:opacity-50 transition-all duration-200">
            {uploading ? 'Uploading…' : '+ Upload PDF'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = '' }} />
        </div>
        {policyDocs.length === 0 ? (
          <p className="text-xs text-[#8D5A2B]/50">No policy documents yet. Upload a PDF to use as analysis context.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {policyDocs.map(doc => (
              <span key={doc.id} className="text-xs px-2 py-1 bg-[#8D5A2B]/10 text-[#825E34] rounded">{doc.filename}</span>
            ))}
          </div>
        )}
      </div>

      {/* Cells */}
      <div className="space-y-4 mb-10">
        {cells.map((cell, i) => {
          const attachedCount = cell.policy_doc_ids.length
          return (
            <div key={i} className="bg-white/60 border border-[#8D5A2B]/30 rounded-xl p-5">
              {/* Cell header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">
                  {cell.topic || `Cell ${i + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  {cell._mode === 'characteristics' && (
                    <button onClick={() => updateCell(i, { _mode: 'prompt' })}
                      className="text-xs px-2 py-1 border border-[#8D5A2B]/40 rounded text-[#825E34] hover:bg-[#8D5A2B]/10 transition-colors">
                      Edit
                    </button>
                  )}
                  <button onClick={() => removeCell(i)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                    Remove
                  </button>
                </div>
              </div>

              {/* Prompt mode */}
              {cell._mode === 'prompt' && (
                <div>
                  <label className="block text-xs font-medium text-[#825E34] mb-1">Prompt</label>
                  <div style={{ position: 'relative' }}>
                    <textarea value={cell.prompt}
                      onChange={e => updateCell(i, { prompt: e.target.value })}
                      rows={4}
                      placeholder="Describe what this cell should evaluate about the startup…"
                      className="w-full px-3 py-2 pr-10 border border-[#8D5A2B]/40 rounded-lg bg-white/60 text-[#825E34] text-sm focus:outline-none focus:border-[#D47E30] resize-none"
                    />
                    {/* Mic button */}
                    <button type="button" onClick={() => toggleVoice(i)}
                      title={recordingCell === i ? 'Stop recording' : 'Start voice input'}
                      style={{
                        position: 'absolute', bottom: 10, right: 10,
                        width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: recordingCell === i ? '#D47E30' : 'rgba(141,90,43,0.12)',
                        color: recordingCell === i ? '#FEFCF5' : '#8D5A2B',
                        transition: 'all 0.15s ease',
                      }}>
                      {recordingCell === i ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <rect x="2" y="2" width="8" height="8" rx="1.5" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="2" width="6" height="11" rx="3" />
                          <path d="M5 10a7 7 0 0 0 14 0" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                          <line x1="9" y1="22" x2="15" y2="22" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <button onClick={() => extractCharacteristics(i)}
                    disabled={cell._extracting || !cell.prompt.trim()}
                    className="mt-3 px-3 py-1.5 bg-[#8D5A2B]/15 text-[#825E34] rounded-lg text-xs font-medium hover:bg-[#8D5A2B]/25 disabled:opacity-40 transition-all duration-200">
                    {cell._extracting ? 'Extracting…' : 'Create Characteristics'}
                  </button>
                </div>
              )}

              {/* Characteristics mode */}
              {cell._mode === 'characteristics' && cell.characteristics.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#825E34] mb-2">Characteristics</label>
                  <div className="space-y-3">
                    {(cell.characteristics ?? []).map((ch, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span className="text-sm text-[#825E34]" style={{ minWidth: 200 }}>{ch.name}</span>
                        <StepSlider value={ch.strength} onChange={v => updateStrength(i, j, v)} />
                        <span className="text-xs font-semibold text-[#D47E30]" style={{ minWidth: 16, textAlign: 'right' }}>{ch.strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attach policy docs — always visible at bottom of cell */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(141,90,43,0.12)' }}>
                <button
                  onClick={() => setDocModalCell(i)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: attachedCount > 0 ? '1.5px solid #D47E30' : '1.5px solid rgba(141,90,43,0.3)',
                    background: attachedCount > 0 ? 'rgba(212,126,48,0.08)' : 'white',
                    color: '#825E34', fontSize: 12, fontWeight: 500,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  {attachedCount > 0 ? 'Policy Docs' : 'Attach Policy Doc'}
                </button>
                {attachedCount > 0 && (
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#D47E30', fontWeight: 600 }}>
                    {attachedCount} doc{attachedCount > 1 ? 's' : ''} attached
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Version history */}
      {versions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[#825E34] mb-4">Version History</h2>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center gap-4 bg-white/60 border border-[#8D5A2B]/30 rounded-xl px-4 py-3">
                <span className="text-sm text-[#825E34]">v{v.version_num}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  v.status === 'live' ? 'bg-green-100 text-green-700' : 'bg-[#8D5A2B]/20 text-[#8D5A2B]'
                }`}>{v.status}</span>
                {v.published_at && (
                  <span className="text-xs text-[#8D5A2B]">{new Date(v.published_at).toLocaleDateString()}</span>
                )}
                {v.published_by_email && (
                  <span className="text-xs text-[#8D5A2B]/60">by {v.published_by_email}</span>
                )}
                {v.status === 'archived' && (
                  <button onClick={() => promoteVersion(v.id)}
                    className="ml-auto text-xs px-3 py-1 border border-[#8D5A2B]/40 text-[#825E34] rounded-lg hover:bg-[#8D5A2B]/10 transition-all duration-150">
                    Set as Live
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
