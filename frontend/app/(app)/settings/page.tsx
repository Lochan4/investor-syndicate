import { withAuth } from '@workos-inc/authkit-nextjs'
import { api, PlatformUser, WorkspaceDetail, Project } from '@/lib/api'
import { SettingsClient } from '@/components/SettingsClient'

export default async function SettingsPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const token = accessToken!

  const me = await api.getMe(token)
  let users: PlatformUser[] = []
  let workspaces: WorkspaceDetail[] = []
  let projects: Project[] = []
  try { users = await api.listUsers(token) } catch {}
  try {
    const ws = await api.listWorkspaces(token)
    workspaces = await Promise.all(ws.map(w => api.getWorkspace(token, w.id)))
  } catch {}
  try { projects = await api.listProjects(token) } catch {}

  return <SettingsClient token={token} me={me} initialUsers={users} initialWorkspaces={workspaces} initialProjects={projects} />
}
