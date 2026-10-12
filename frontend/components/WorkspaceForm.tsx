'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export function WorkspaceForm({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '' })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Workspace name is required'); return }
    setError(''); setLoading(true)
    try {
      const ws = await api.createWorkspace(token, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })
      router.push(`/workspaces/${ws.id}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 w-full max-w-[420px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">Group startups and invite your team</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Workspace Name *</label>
          <input
            id="name"
            className="input"
            placeholder="e.g. Series A Pipeline 2026"
            autoFocus
            value={form.name}
            onChange={set('name')}
          />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea
            id="description"
            className="input resize-none"
            rows={3}
            placeholder="What is this workspace for?"
            value={form.description}
            onChange={set('description')}
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-ghost flex-1 py-3 text-[15px] rounded-xl"
        >
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 text-[15px] rounded-xl">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creating…
            </span>
          ) : 'Create Workspace'}
        </button>
      </div>
    </form>
  )
}
