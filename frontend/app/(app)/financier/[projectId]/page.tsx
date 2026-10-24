import { withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { api } from '@/lib/api'
import { FinancierDetailClient } from './FinancierDetailClient'

export default async function FinancierDetailPage({ params }: { params: { projectId: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const token = accessToken!
  const me = await api.getMe(token)
  if (!['super_admin', 'admin'].includes(me.platform_role)) redirect('/admin/conversation')
  const [breakdown, users] = await Promise.all([
    api.getProspectBreakdown(token, params.projectId),
    api.listUsers(token),
  ])
  return <FinancierDetailClient token={token} breakdown={breakdown} allUsers={users} />
}
