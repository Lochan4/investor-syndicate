import { withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { api } from '@/lib/api'
import { FinancierClient } from './FinancierClient'

export default async function FinancierPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const token = accessToken!
  const me = await api.getMe(token)
  if (!['super_admin', 'admin'].includes(me.platform_role)) redirect('/admin/conversation')
  const prospects = await api.listProspects(token)
  return <FinancierClient token={token} initialProspects={prospects} />
}
