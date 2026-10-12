'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export function ProjectForm({ token, workspaceId }: { token: string; workspaceId?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ startup_name: '', sector: '', stage: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.startup_name.trim()) { setError('Startup name is required'); return }
    setError(''); setLoading(true)
    try {
      const body = { startup_name: form.startup_name.trim(), sector: form.sector || undefined, stage: form.stage || undefined }
      const p = workspaceId
        ? await api.createWorkspaceProject(token, workspaceId, body)
        : await api.createProject(token, body)
      router.push(`/projects/${p.id}/assets`)
    } catch (err: any) {
      setError(err?.message || 'Failed to create project')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New Project</h1>
        <p className="text-sm text-slate-500 mt-1">Start a new due diligence process</p>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="startup_name">Startup Name *</label>
          <input
            id="startup_name"
            className="input"
            placeholder="e.g. Acme Corp"
            autoFocus
            value={form.startup_name}
            onChange={set('startup_name')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sector">Sector</label>
            <select id="sector" className="input" value={form.sector} onChange={set('sector')}>
              {['FinTech','HealthTech','EdTech','SaaS','Consumer','DeepTech','CleanTech','Other'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="stage">Stage</label>
            <select id="stage" className="input" value={form.stage} onChange={set('stage')}>
              <option value="">Any stage</option>
              {['Pre-seed','Seed','Series A','Series B','Series C+','Growth'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px] rounded-xl">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Creating…
          </span>
        ) : 'Create Project'}
      </button>

      <p className="text-xs text-center text-slate-400">
        You can invite investors and upload documents after creating the project.
      </p>
    </form>
  )
}
