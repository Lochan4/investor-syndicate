import { withAuth } from '@workos-inc/authkit-nextjs'
import { api } from '@/lib/api'
import { FlowCanvas } from '@/components/flow/FlowCanvas'

export default async function FlowPage({ params }: { params: { id: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let data: { cells: import('@/lib/api').FlowCell[]; edges: import('@/lib/api').FlowEdge[] } = { cells: [], edges: [] }
  try { data = await api.getFlowCells(accessToken!, params.id) } catch {}
  return (
    <div className="h-screen flex flex-col" data-testid="flow-canvas">
      <div className="px-6 py-4 border-b border-[#8D5A2B]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href={`/projects/${params.id}`} className="text-[#8D5A2B] hover:text-[#D47E30] transition-colors">← Hub</a>
          <h2 className="font-semibold text-[#825E34]">Flow Canvas</h2>
        </div>
        <span className="text-xs text-[#8D5A2B]">{data.cells.length} cells</span>
      </div>
      <div className="flex-1">
        <FlowCanvas projectId={params.id} cells={data.cells} edges={data.edges} token={accessToken!} />
      </div>
    </div>
  )
}
