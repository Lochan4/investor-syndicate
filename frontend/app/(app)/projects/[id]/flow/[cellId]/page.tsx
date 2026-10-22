import { withAuth } from '@workos-inc/authkit-nextjs'
import { ConversationPanel } from '@/components/CellChat'
import { LeftAssetsPanel } from '@/components/LeftAssetsPanel'
import { WindowCanvas } from '@/components/WindowCanvas'
import { api } from '@/lib/api'

export default async function CellPage({ params }: { params: { id: string; cellId: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let cells: any = { cells: [] }
  try { cells = await api.getFlowCells(accessToken!, params.id) } catch {}
  const cell = cells.cells.find((c: any) => c.id === params.cellId)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--background, #FAFAF8)' }} data-testid="cell-chat">
      <div className="px-6 py-3 border-b border-stroke flex items-center gap-3 bg-surface">
        <a href={`/projects/${params.id}/flow`} className="text-muted hover:text-ink transition-colors text-sm">← Flow</a>
        <span className="text-stroke">|</span>
        <h2 className="font-semibold text-amber-600 text-sm">{cell?.topic || 'Cell'}</h2>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="shrink-0 border-r border-stroke flex flex-col overflow-hidden">
          <LeftAssetsPanel projectId={params.id} token={accessToken!} />
        </div>
        <div className="flex-1 border-r border-stroke flex flex-col overflow-hidden">
          <WindowCanvas projectId={params.id} cellId={params.cellId} token={accessToken!} />
        </div>
        <div className="shrink-0 flex flex-col overflow-hidden">
          <ConversationPanel
            projectId={params.id}
            cellId={params.cellId}
            cellTopic={cell?.topic}
            token={accessToken!}
          />
        </div>
      </div>
    </div>
  )
}
