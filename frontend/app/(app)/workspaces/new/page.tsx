import { withAuth } from '@workos-inc/authkit-nextjs'
import { api } from '@/lib/api'
import { WorkspaceForm } from '@/components/WorkspaceForm'
import { redirect } from 'next/navigation'

export default async function NewWorkspacePage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const me = await api.getMe(accessToken!)
  if (!['super_admin', 'admin', 'developer'].includes(me.platform_role)) {
    redirect('/workspaces')
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-background">
      <WorkspaceForm token={accessToken!} />
    </div>
  )
}
