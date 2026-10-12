'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export function ApplicationActions({
  token,
  appId,
  status,
}: {
  token: string
  appId: string
  status: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const update = async (newStatus: string) => {
    setLoading(newStatus)
    try {
      await api.updateApplicationStatus(token, appId, newStatus)
      router.refresh()
    } catch {
      // ignore — page will stay as-is
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {status === 'submitted' && (
        <button
          onClick={() => update('reviewing')}
          disabled={!!loading}
          className="btn-ghost"
        >
          {loading === 'reviewing' ? 'Saving…' : 'Mark as Reviewing'}
        </button>
      )}
      <button
        onClick={() => update('rejected')}
        disabled={!!loading}
        className="btn-ghost"
        style={{ color: '#B91C1C', borderColor: 'rgba(239,68,68,0.3)' }}
      >
        {loading === 'rejected' ? 'Saving…' : 'Reject'}
      </button>
    </div>
  )
}
