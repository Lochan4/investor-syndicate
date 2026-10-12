'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export function OpenCanvasButton({ token, projectId }: { token: string; projectId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const open = async () => {
    setLoading(true)
    setError('')
    try {
      await api.openProject(token, projectId)
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to open canvas')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={open}
        disabled={loading}
        className="px-4 py-2.5 bg-[#D47E30] text-white rounded-lg text-sm font-medium hover:bg-[#B86A20] disabled:opacity-50 transition-all duration-200"
      >
        {loading ? 'Opening…' : 'Open Canvas'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
