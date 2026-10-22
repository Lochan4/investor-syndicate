import { withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { api } from '@/lib/api'
import { InvestorStage1 } from './Stage1Client'

export default async function InvestorPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let role = 'investor'
  try { role = (await api.getMe(accessToken!)).platform_role } catch {}
  if (role !== 'investor') redirect('/admin/conversation')
  return <InvestorStage1 token={accessToken!} />
}
