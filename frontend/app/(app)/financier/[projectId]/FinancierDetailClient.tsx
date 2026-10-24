'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api, FinancierBreakdown, FinancierCommitment, PlatformUser } from '@/lib/api'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(given: number, promised: number) {
  if (promised <= 0) return 0
  return Math.min(100, (given / promised) * 100)
}

function CommitmentRow({
  c, token, projectId, onUpdated, onDeleted,
}: {
  c: FinancierCommitment; token: string; projectId: string
  onUpdated: (c: FinancierCommitment) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [promised, setPromised] = useState(String(c.amount_promised))
  const [given, setGiven] = useState(String(c.amount_given))
  const [notes, setNotes] = useState(c.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.upsertCommitment(token, projectId, {
        user_id: c.user_id,
        amount_promised: parseFloat(promised) || 0,
        amount_given: parseFloat(given) || 0,
        notes: notes || undefined,
      })
      onUpdated({ ...c, ...updated })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!confirm(`Remove commitment for ${c.email}?`)) return
    setDeleting(true)
    try {
      await api.deleteCommitment(token, c.id)
      onDeleted(c.id)
    } finally {
      setDeleting(false)
    }
  }

  const remaining = c.amount_promised - c.amount_given

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid rgba(254,252,245,0.06)' }}>
        <td style={{ padding: '14px 16px', color: '#FEFCF5', fontSize: 13 }}>{c.email}</td>
        <td style={{ padding: '14px 16px' }}>
          <input
            type="number" value={promised} onChange={e => setPromised(e.target.value)}
            style={{ width: 110, padding: '5px 8px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.15)', borderRadius: 8, color: '#FEFCF5', fontSize: 13 }}
          />
        </td>
        <td style={{ padding: '14px 16px' }}>
          <input
            type="number" value={given} onChange={e => setGiven(e.target.value)}
            style={{ width: 110, padding: '5px 8px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.15)', borderRadius: 8, color: '#FEFCF5', fontSize: 13 }}
          />
        </td>
        <td style={{ padding: '14px 16px', color: 'rgba(254,252,245,0.4)', fontSize: 13 }}>—</td>
        <td style={{ padding: '14px 16px' }}>
          <input
            value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes"
            style={{ width: '100%', padding: '5px 8px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.15)', borderRadius: 8, color: '#FEFCF5', fontSize: 12 }}
          />
        </td>
        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
          <button onClick={save} disabled={saving}
            style={{ marginRight: 8, padding: '4px 12px', background: '#D47E30', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)}
            style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(254,252,245,0.15)', borderRadius: 7, color: 'rgba(254,252,245,0.5)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={{ borderBottom: '1px solid rgba(254,252,245,0.06)' }}>
      <td style={{ padding: '14px 16px', color: '#FEFCF5', fontSize: 13 }}>{c.email}</td>
      <td style={{ padding: '14px 16px', color: '#FEFCF5', fontSize: 13, fontWeight: 600 }}>{fmt(c.amount_promised)}</td>
      <td style={{ padding: '14px 16px', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>{fmt(c.amount_given)}</td>
      <td style={{ padding: '14px 16px', color: remaining > 0 ? '#D47E30' : 'rgba(254,252,245,0.3)', fontSize: 13, fontWeight: 600 }}>
        {fmt(remaining)}
        {c.amount_promised > 0 && (
          <div style={{ marginTop: 4, height: 2, width: 60, borderRadius: 9999, background: 'rgba(254,252,245,0.08)' }}>
            <div style={{ height: '100%', borderRadius: 9999, width: `${pct(c.amount_given, c.amount_promised)}%`, background: '#22c55e' }} />
          </div>
        )}
      </td>
      <td style={{ padding: '14px 16px', color: 'rgba(254,252,245,0.35)', fontSize: 12 }}>{c.notes ?? '—'}</td>
      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
        <button onClick={() => setEditing(true)}
          style={{ marginRight: 8, padding: '4px 10px', background: 'transparent', border: '1px solid rgba(212,126,48,0.25)', borderRadius: 7, color: '#D47E30', fontSize: 12, cursor: 'pointer' }}>
          Edit
        </button>
        <button onClick={del} disabled={deleting}
          style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, color: 'rgba(239,68,68,0.6)', fontSize: 12, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
          {deleting ? '…' : 'Remove'}
        </button>
      </td>
    </tr>
  )
}

export function FinancierDetailClient({
  token, breakdown, allUsers,
}: {
  token: string; breakdown: FinancierBreakdown; allUsers: PlatformUser[]
}) {
  const router = useRouter()
  const [commitments, setCommitments] = useState(breakdown.commitments)
  const [showAdd, setShowAdd] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [addPromised, setAddPromised] = useState('')
  const [addGiven, setAddGiven] = useState('0')
  const [addNotes, setAddNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const totalPromised = commitments.reduce((s, c) => s + c.amount_promised, 0)
  const totalGiven    = commitments.reduce((s, c) => s + c.amount_given,    0)
  const totalRemaining = totalPromised - totalGiven

  // Users not yet in commitments
  const existingUserIds = new Set(commitments.map(c => c.user_id))
  const availableUsers = allUsers.filter(u => !existingUserIds.has(u.id))

  const addCommitment = async () => {
    if (!addUserId || !addPromised) return
    setAdding(true)
    setAddError('')
    try {
      const c = await api.upsertCommitment(token, breakdown.project.id, {
        user_id: addUserId,
        amount_promised: parseFloat(addPromised),
        amount_given: parseFloat(addGiven) || 0,
        notes: addNotes || undefined,
      })
      const user = allUsers.find(u => u.id === addUserId)
      setCommitments(prev => [...prev, { ...c, user_id: addUserId, email: user?.email ?? addUserId }])
      setShowAdd(false)
      setAddUserId('')
      setAddPromised('')
      setAddGiven('0')
      setAddNotes('')
    } catch (e: any) {
      setAddError(e.message ?? 'Failed to add commitment')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a18', padding: '32px 48px 80px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Back */}
        <button
          onClick={() => router.push('/financier')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(254,252,245,0.35)', fontSize: 13, marginBottom: 24, padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(254,252,245,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(254,252,245,0.35)')}
        >
          <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All Prospects
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FEFCF5', margin: '0 0 4px' }}>
            {breakdown.project.startup_name}
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {breakdown.project.sector && (
              <span style={{ fontSize: 11, color: 'rgba(254,252,245,0.4)' }}>{breakdown.project.sector}</span>
            )}
            {breakdown.project.stage && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(212,126,48,0.12)', color: '#D47E30', fontWeight: 600 }}>
                {breakdown.project.stage}
              </span>
            )}
          </div>
        </div>

        {/* Totals row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Total Promised', value: fmt(totalPromised), color: '#FEFCF5' },
            { label: 'Total Given',    value: fmt(totalGiven),    color: '#22c55e' },
            { label: 'Total Remaining', value: fmt(totalRemaining), color: totalRemaining > 0 ? '#D47E30' : 'rgba(254,252,245,0.3)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '18px 20px', background: 'rgba(254,252,245,0.04)', border: '1px solid rgba(254,252,245,0.08)', borderRadius: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(254,252,245,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {totalPromised > 0 && (
          <div style={{ height: 4, borderRadius: 9999, background: 'rgba(254,252,245,0.06)', marginBottom: 32 }}>
            <div style={{ height: '100%', borderRadius: 9999, width: `${pct(totalGiven, totalPromised)}%`, background: '#22c55e', transition: 'width 0.3s ease' }} />
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'rgba(254,252,245,0.03)', border: '1px solid rgba(254,252,245,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(254,252,245,0.07)' }}>
                {['Investor', 'Promised', 'Given', 'Remaining', 'Notes', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(254,252,245,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commitments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(254,252,245,0.3)', fontSize: 13 }}>
                    No commitments yet. Add the first one below.
                  </td>
                </tr>
              ) : (
                commitments.map(c => (
                  <CommitmentRow
                    key={c.id} c={c} token={token} projectId={breakdown.project.id}
                    onUpdated={updated => setCommitments(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x))}
                    onDeleted={id => setCommitments(prev => prev.filter(x => x.id !== id))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add commitment */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            style={{ padding: '9px 18px', background: 'rgba(212,126,48,0.1)', border: '1px solid rgba(212,126,48,0.25)', borderRadius: 10, color: '#D47E30', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,126,48,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,126,48,0.1)')}
          >
            + Add Commitment
          </button>
        ) : (
          <div style={{ background: 'rgba(254,252,245,0.04)', border: '1px solid rgba(254,252,245,0.1)', borderRadius: 14, padding: '20px 22px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(254,252,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>New Commitment</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(254,252,245,0.4)', display: 'block', marginBottom: 4 }}>Investor</label>
                <select
                  value={addUserId} onChange={e => setAddUserId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.12)', borderRadius: 8, color: '#FEFCF5', fontSize: 13 }}
                >
                  <option value="">Select user…</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(254,252,245,0.4)', display: 'block', marginBottom: 4 }}>Amount Promised</label>
                <input
                  type="number" placeholder="0" value={addPromised} onChange={e => setAddPromised(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.12)', borderRadius: 8, color: '#FEFCF5', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(254,252,245,0.4)', display: 'block', marginBottom: 4 }}>Amount Given</label>
                <input
                  type="number" placeholder="0" value={addGiven} onChange={e => setAddGiven(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.12)', borderRadius: 8, color: '#FEFCF5', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(254,252,245,0.4)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
              <input
                value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="e.g. Tranche 1"
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(254,252,245,0.06)', border: '1px solid rgba(254,252,245,0.12)', borderRadius: 8, color: '#FEFCF5', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            {addError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{addError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addCommitment} disabled={adding || !addUserId || !addPromised}
                style={{ padding: '8px 18px', background: '#D47E30', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (adding || !addUserId || !addPromised) ? 0.5 : 1 }}>
                {adding ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => { setShowAdd(false); setAddError('') }}
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(254,252,245,0.12)', borderRadius: 8, color: 'rgba(254,252,245,0.4)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
