import { redirect } from 'next/navigation'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { api } from '@/lib/api'

export default async function AppRoot() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let role = 'investor'
  try { role = (await api.getMe(accessToken!)).platform_role } catch {}
  if (role === 'investor') redirect('/investor')
  redirect('/admin/conversation')
}
