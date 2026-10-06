'use client'
import { useState, useEffect } from 'react'
import { streamActivityFeed, ActivityEvent } from '@/lib/api'
import { ActivityFeed } from './ActivityFeed'

export function AssistantPanel({ projectId, cellId, token }: {
  projectId: string; cellId: string; token: string
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [active, setActive] = useState(false)

  useEffect(() => {
    const stop = streamActivityFeed(projectId, cellId, token, (e) => {
      setActive(true)
      setEvents(prev => [...prev, e])
    })
    return stop
  }, [projectId, cellId, token])

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 py-3 border-b border-stroke flex items-center gap-2">
        <span className="section-header">Assistant</span>
        {active && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            Working
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-subtle py-16">
          <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
            <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-xs text-center max-w-[180px]">The assistant will search and browse when relevant to your questions</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ActivityFeed events={events} />
        </div>
      )}
    </div>
  )
}
