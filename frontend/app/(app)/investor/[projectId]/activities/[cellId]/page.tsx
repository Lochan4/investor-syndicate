import { withAuth } from '@workos-inc/authkit-nextjs'
import { api } from '@/lib/api'
import { InvestorStage3 } from './Stage3Client'

export default async function InvestorActivityPage({
  params,
}: {
  params: { projectId: string; cellId: string }
}) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let cells: any = { cells: [] }
  let projectName = ''
  try { cells = await api.getFlowCells(accessToken!, params.projectId) } catch {}
  try {
    const p = await api.getProject(accessToken!, params.projectId)
    projectName = p.startup_name
  } catch {}
  const cell = cells.cells.find((c: any) => c.id === params.cellId)

  return (
    <InvestorStage3
      projectId={params.projectId}
      projectName={projectName}
      cellId={params.cellId}
      cellTopic={cell?.topic}
      token={accessToken!}
    />
  )
}
