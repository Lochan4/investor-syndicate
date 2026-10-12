'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from './Toast'

export function CompetitiveScanButton({ token, projectId }: { token: string; projectId: string }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const run = async () => {
    setLoading(true)
    try {
      await api.triggerCompetitiveScan(token, projectId)
      toast('Competitive scan queued — results will appear in Assets when ready', 'success')
    } catch {
      toast('Failed to queue scan. Make sure SERPER_API_KEY is set in the backend.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="btn-primary flex items-center gap-2 text-sm"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          <path d="M11 8v6M8 11h6"/>
        </svg>
      )}
      {loading ? 'Queuing…' : 'Run Competitive Scan'}
    </button>
  )
}
