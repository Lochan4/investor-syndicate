'use client'
import { useEffect, useState, useRef } from 'react'
import { api, Notification } from '@/lib/api'
import { Icons } from './Icons'

export function NotificationBell({ token, unreadCount }: { token?: string; unreadCount?: number }) {
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    const load = () => api.listNotifications(token).then(setNotes).catch(() => {})
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [token])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const count = token ? notes.length : (unreadCount ?? 0)

  const markRead = async (id: string) => {
    if (!token) return
    await api.markRead(token, id).catch(() => {})
    setNotes(n => n.filter(x => x.id !== id))
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications" className="relative p-2 rounded-lg text-brown-mid hover:text-amber hover:bg-amber/10 transition-all duration-200">
        <Icons.Bell />
        {count > 0 && (
          <span data-testid="unread-badge" className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber text-cream text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && token && (
        <div className="absolute right-0 top-10 w-80 bg-cream border border-brown-mid/30 rounded-xl shadow-xl z-50 animate-fade-in overflow-hidden">
          <div className="px-4 py-3 border-b border-brown-mid/20">
            <span className="text-sm font-semibold text-brown-dark">Notifications</span>
          </div>
          {notes.length === 0 ? (
            <div className="px-4 py-6 text-sm text-brown-mid text-center">All caught up</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-brown-mid/10">
              {notes.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-amber/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brown-dark capitalize">
                      {n.kind.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-brown-mid mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button onClick={() => markRead(n.id)} className="btn-ghost shrink-0 text-xs">
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
