'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, Workspace } from '@/lib/api'

export function AddToWorkspaceButton({
  token,
  appId,
  workspaces,
}: {
  token: string
  appId: string
  workspaces: Workspace[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!workspaceId) return
    setLoading(true); setError('')
    try {
      const res = await api.addApplicationToWorkspace(token, appId, workspaceId)
      router.push(`/workspaces/${res.workspace_id}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to add to workspace')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary"
        style={{ background: '#15803D', borderColor: '#15803D' }}
      >
        Add to Workspace
      </button>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 400 }}>
      <p className="text-sm font-semibold text-ink mb-3">Select a workspace</p>
      {workspaces.length === 0 ? (
        <p className="text-sm text-muted">No workspaces found. Create one first.</p>
      ) : (
        <>
          <select
            className="input mb-3"
            value={workspaceId}
            onChange={e => setWorkspaceId(e.target.value)}
          >
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1"
              style={{ background: '#15803D', borderColor: '#15803D' }}>
              {loading ? 'Adding…' : 'Confirm'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
