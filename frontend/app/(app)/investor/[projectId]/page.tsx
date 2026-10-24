import { withAuth } from '@workos-inc/authkit-nextjs'
import { api } from '@/lib/api'
import { InvestorStage2 } from './Stage2Client'

export default async function InvestorProjectPage({ params }: { params: { projectId: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  return <InvestorStage2 projectId={params.projectId} token={accessToken!} />
}
