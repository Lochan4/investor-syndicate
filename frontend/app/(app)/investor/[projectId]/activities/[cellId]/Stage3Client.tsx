'use client'
import { useRouter } from 'next/navigation'
import { WindowCanvas } from '@/components/WindowCanvas'
import { ConversationPanel } from '@/components/CellChat'

export function InvestorStage3({
  projectId,
  projectName,
  cellId,
  cellTopic,
  token,
}: {
  projectId: string
  projectName: string
  cellId: string
  cellTopic?: string
  token: string
}) {
  const router = useRouter()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      background: 'var(--background, #FAFAF8)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid rgba(141,90,43,0.12)',
        background: '#FEFCF5',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push(`/investor/${projectId}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(141,90,43,0.55)', fontSize: 13, fontWeight: 500,
            transition: 'color 0.15s', padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#8D5A2B')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(141,90,43,0.55)')}
        >
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {projectName || 'Project'}
        </button>
        <span style={{ color: 'rgba(141,90,43,0.25)', fontSize: 13 }}>|</span>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C4611A' }}>
          {cellTopic || 'Activity'}
        </h2>
      </div>

      {/* Two-column: canvas + chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, borderRight: '1px solid rgba(141,90,43,0.12)', overflow: 'hidden' }}>
          <WindowCanvas projectId={projectId} cellId={cellId} token={token} />
        </div>
        <div style={{ flexShrink: 0, overflow: 'hidden' }}>
          <ConversationPanel
            projectId={projectId}
            cellId={cellId}
            cellTopic={cellTopic}
            token={token}
          />
        </div>
      </div>
    </div>
  )
}
