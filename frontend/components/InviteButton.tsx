'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

const ROLES = [
  { value: 'admin',    label: 'Admin' },
  { value: 'attendee', label: 'Attendee' },
]

export function InviteButton({ token, projectId }: { token: string; projectId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const reset = () => { setEmail(''); setRole(''); setError(''); setSuccess(false) }

  const send = async () => {
    setLoading(true)
    setError('')
    try {
      await api.inviteUser(token, email, projectId, role)
      setSuccess(true)
      setTimeout(() => { setOpen(false); reset() }, 1500)
    } catch (e: any) {
      setError(e?.message ?? 'Invite failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="fixed bottom-6 right-6 px-4 py-2.5 bg-[#D47E30] text-white rounded-lg text-sm font-semibold hover:bg-[#B86A20] transition-all duration-200 shadow-lg"
      >
        Invite
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-900 mb-4">Invite to project</h2>

            <div className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700"
              >
                <option value="">Select a role…</option>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            {success && <p className="text-xs text-green-600 mt-2">Invite sent!</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={!role || !email || loading}
                className="px-4 py-2.5 bg-[#D47E30] text-white rounded-lg text-sm font-semibold hover:bg-[#B86A20] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
