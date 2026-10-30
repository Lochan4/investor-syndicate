'use client'
import { useState, useRef } from 'react'
import { api } from '@/lib/api'

const SECTORS = ['FinTech', 'HealthTech', 'EdTech', 'SaaS', 'Consumer', 'DeepTech', 'CleanTech', 'Other']
const STAGES  = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Growth']

type Step = 1 | 2 | 3

const STEP_LABELS = ['Your Details', 'Pitch Deck', 'Review & Submit']

// ── shared input style that works on the cream landing bg ──
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid rgba(15,45,107,0.22)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.7)',
  fontSize: 14,
  color: '#1C1917',
  outline: 'none',
  backdropFilter: 'blur(4px)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(28,25,23,0.55)',
  marginBottom: 6,
  letterSpacing: '0.03em',
}

export function ApplySection() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [startupName, setStartupNameState] = useState('')

  const [form, setForm] = useState({
    founder_name: '', founder_email: '', startup_name: '',
    sector: '', stage: '', one_liner: '', website: '',
  })
  const [pitchFile, setPitchFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pitchKey, setPitchKey] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const uploadPitch = async (file: File) => {
    setUploading(true)
    try {
      const { upload_url, storage_key } = await api.getApplyUploadUrl(file.name, file.type || 'application/pdf')
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/pdf' } })
      setPitchKey(storage_key)
    } catch {
      setError('File upload failed. You can skip and continue.')
    } finally {
      setUploading(false)
    }
  }

  const next = () => {
    setError('')
    if (step === 1) {
      if (!form.founder_name.trim()) { setError('Founder name is required'); return }
      if (!form.founder_email.trim()) { setError('Email is required'); return }
      if (!form.startup_name.trim()) { setError('Startup name is required'); return }
    }
    setStep(s => Math.min(s + 1, 3) as Step)
  }

  const submit = async () => {
    setLoading(true); setError('')
    try {
      const result = await api.submitApplication({
        founder_name: form.founder_name.trim(),
        founder_email: form.founder_email.trim(),
        startup_name: form.startup_name.trim(),
        sector: form.sector || undefined,
        stage: form.stage || undefined,
        one_liner: form.one_liner.trim() || undefined,
        website: form.website.trim() || undefined,
        pitch_doc_key: pitchKey || undefined,
        pitch_doc_name: pitchFile?.name || undefined,
      })
      setStartupNameState(form.startup_name.trim())
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please try again.')
      setLoading(false)
    }
  }

  // ── Success state ──────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.2">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', marginBottom: 8 }}>
          Application submitted!
        </h3>
        <p style={{ fontSize: 14, color: 'rgba(28,25,23,0.55)', lineHeight: 1.7 }}>
          We've received your application for <strong style={{ color: '#1C1917' }}>{startupName}</strong>.
          Our team will review it and get back to you shortly.
        </p>
      </div>
    )
  }

  // ── Step indicator ─────────────────────────────────────────
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, justifyContent: 'center' }}>
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step
        const active = step === n
        const done = step > n
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: done ? '#15803D' : active ? '#FCB303' : 'rgba(15,45,107,0.1)',
                color: done || active ? '#fff' : 'rgba(28,25,23,0.4)',
                flexShrink: 0,
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: active ? '#FCB303' : done ? '#15803D' : 'rgba(28,25,23,0.4)',
                display: 'none',
              }}
                className="sm-show"
              >
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ width: 32, height: 1, background: 'rgba(15,45,107,0.18)', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )

  const fieldRow = (children: React.ReactNode, cols = 1) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  )

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '0 24px' }}>
      <StepIndicator />

      {/* Step 1 — Details */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fieldRow(<>
            <div>
              <label style={labelStyle}>Founder Name *</label>
              <input style={inputStyle} placeholder="Jane Smith" value={form.founder_name} onChange={set('founder_name')} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" placeholder="jane@startup.com" value={form.founder_email} onChange={set('founder_email')} />
            </div>
          </>, 2)}
          <div>
            <label style={labelStyle}>Startup Name *</label>
            <input style={inputStyle} placeholder="Acme Inc." value={form.startup_name} onChange={set('startup_name')} />
          </div>
          {fieldRow(<>
            <div>
              <label style={labelStyle}>Sector</label>
              <select style={inputStyle} value={form.sector} onChange={set('sector')}>
                <option value="">Select…</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Stage</label>
              <select style={inputStyle} value={form.stage} onChange={set('stage')}>
                <option value="">Select…</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>, 2)}
          <div>
            <label style={labelStyle}>One-liner</label>
            <input style={inputStyle} placeholder="We build X for Y so they can Z" value={form.one_liner} onChange={set('one_liner')} />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input style={inputStyle} type="url" placeholder="https://yourstartup.com" value={form.website} onChange={set('website')} />
          </div>
        </div>
      )}

      {/* Step 2 — Upload */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${pitchFile ? 'rgba(21,128,61,0.5)' : 'rgba(15,45,107,0.25)'}`,
              borderRadius: 14,
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: pitchFile ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.pptx,.ppt" style={{ display: 'none' }}
              onChange={async e => {
                const f = e.target.files?.[0]
                if (!f) return
                setPitchFile(f)
                await uploadPitch(f)
              }}
            />
            {uploading ? (
              <p style={{ fontSize: 13, color: '#FCB303', fontWeight: 600 }}>Uploading…</p>
            ) : pitchFile ? (
              <>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>{pitchFile.name}</p>
                <p style={{ fontSize: 12, color: 'rgba(28,25,23,0.4)', marginTop: 4 }}>Click to replace</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'rgba(28,25,23,0.5)' }}>Click to upload PDF or PPTX</p>
                <p style={{ fontSize: 11, color: 'rgba(28,25,23,0.35)', marginTop: 4 }}>Max 50 MB · Optional</p>
              </>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(28,25,23,0.4)', textAlign: 'center' }}>
            You can skip this step and submit without a pitch deck.
          </p>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div style={{
          border: '1px solid rgba(15,45,107,0.14)',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.5)',
        }}>
          {[
            ['Founder', form.founder_name],
            ['Email', form.founder_email],
            ['Startup', form.startup_name],
            ['Sector', form.sector],
            ['Stage', form.stage],
            ['One-liner', form.one_liner],
            ['Website', form.website],
            ['Pitch Deck', pitchFile?.name],
          ].filter(([, v]) => v).map(([label, value], i, arr) => (
            <div key={label as string} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(15,45,107,0.08)' : 'none',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(28,25,23,0.45)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 13, color: '#1C1917', fontWeight: 600, maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 14, fontSize: 13, color: '#B91C1C',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '10px 14px',
        }}>
          {error}
        </div>
      )}

      {/* Nav buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button
            onClick={() => setStep(s => (s - 1) as Step)}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
              background: 'transparent', border: '1.5px solid rgba(15,45,107,0.25)',
              color: '#0F2D6B', cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={next}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, fontWeight: 700, fontSize: 14,
              background: '#FCB303', border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={loading}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, fontWeight: 700, fontSize: 14,
              background: loading ? 'rgba(252,179,3,0.6)' : '#FCB303',
              border: 'none', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Submitting…</>
              : 'Submit Application'}
          </button>
        )}
      </div>
    </div>
  )
}
