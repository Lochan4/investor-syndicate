'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, Project, Analysis } from '@/lib/api'

function AnalysisSummary({ analysis }: { analysis: Analysis }) {
  const [expanded, setExpanded] = useState(false)
  const content = analysis.content

  // Extract a readable summary — the content structure varies; show stringified if no known key
  const summary: string =
    typeof content?.summary === 'string' ? content.summary :
    typeof content?.recommendation === 'string' ? content.recommendation :
    typeof content === 'string' ? content :
    JSON.stringify(content).slice(0, 400)

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(141,90,43,0.05)', border: '1px solid rgba(141,90,43,0.12)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          {analysis.stage === 'final' ? 'Final Consensus' : 'Group Summary'}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-amber font-medium"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <p className="text-sm text-ink leading-relaxed"
        style={{ WebkitLineClamp: expanded ? undefined : 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' }}>
        {summary}
      </p>
    </div>
  )
}

export function DecisionPanel({
  token,
  project,
  analyses,
  canDecide,
}: {
  token: string
  project: Project
  analyses: Analysis[]
  canDecide: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(project.decision_notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finalAnalysis = analyses.find(a => a.stage === 'final') ?? analyses.find(a => a.stage === 'group') ?? null

  const save = async (investable: boolean) => {
    setLoading(true); setError('')
    try {
      await api.setProjectDecision(token, project.id, investable, notes.trim() || undefined)
      router.refresh()
      setEditing(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to save decision')
    } finally {
      setLoading(false)
    }
  }

  const hasDecision = project.is_investable !== null && project.is_investable !== undefined

  return (
    <div className="card mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink">Investment Decision</h2>
        {hasDecision && canDecide && !editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs px-3 py-1.5">
            Change
          </button>
        )}
      </div>

      {/* Final analysis summary if available */}
      {finalAnalysis && <AnalysisSummary analysis={finalAnalysis} />}

      {/* Current decision state */}
      {!editing && (
        <>
          {!hasDecision ? (
            <div className="flex items-center gap-3 py-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(141,90,43,0.3)' }} />
              <span className="text-sm text-muted">No decision yet</span>
            </div>
          ) : project.is_investable ? (
            <div className="flex items-center gap-3 py-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-semibold" style={{ color: '#15803D' }}>Investable</span>
              {project.decided_at && (
                <span className="text-xs text-muted">
                  · {new Date(project.decided_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Not Investable</span>
              {project.decided_at && (
                <span className="text-xs text-muted">
                  · {new Date(project.decided_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          )}

          {project.decision_notes && (
            <p className="text-sm text-muted mt-2 pt-3 border-t border-stroke">{project.decision_notes}</p>
          )}

          {/* First-time decision buttons */}
          {!hasDecision && canDecide && !editing && (
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditing(true)} className="btn-primary flex-1">
                Record Decision
              </button>
            </div>
          )}
        </>
      )}

      {/* Decision form */}
      {editing && canDecide && (
        <div className="space-y-4">
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Rationale for this decision…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setEditing(false); setError('') }}
              className="btn-ghost flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={() => save(false)}
              disabled={loading}
              className="btn-ghost flex-1"
              style={{ color: '#B91C1C', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              Not Investable
            </button>
            <button
              onClick={() => save(true)}
              disabled={loading}
              className="btn-primary flex-1"
              style={{ background: '#15803D' }}
            >
              {loading ? 'Saving…' : 'Investable'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
