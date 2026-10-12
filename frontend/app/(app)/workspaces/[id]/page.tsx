import { withAuth } from '@workos-inc/authkit-nextjs'
import { api, Project, WorkspaceDetail } from '@/lib/api'
import { ProjectCard } from '@/components/ProjectCard'
import { Icons } from '@/components/Icons'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'developer'])

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })

  let workspace: WorkspaceDetail | null = null
  let projects: Project[] = []
  let platformRole = 'investor'

  try {
    const [ws, projs, me] = await Promise.all([
      api.getWorkspace(accessToken!, params.id),
      api.listWorkspaceProjects(accessToken!, params.id),
      api.getMe(accessToken!),
    ])
    workspace = ws
    projects = projs
    platformRole = me.platform_role
  } catch (err: any) {
    if (err?.message?.includes('403')) redirect('/workspaces')
    if (err?.message?.includes('404')) notFound()
    // other errors — fall through and show empty
  }

  if (!workspace) notFound()

  const canManage = ADMIN_ROLES.has(platformRole)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">{workspace.name}</h1>
          {workspace.description && (
            <p className="page-subtitle mt-1">{workspace.description}</p>
          )}
        </div>
        {canManage && (
          <Link href={`/workspaces/${params.id}/projects/new`} className="btn-primary">
            <Icons.Plus /> New Project
          </Link>
        )}
      </div>

      {/* Projects grid */}
      {projects.length === 0 ? (
        <div className="card text-center py-16 mb-8">
          <div className="inline-flex p-3 bg-stroke rounded-xl mb-4 text-muted">
            <Icons.Folder />
          </div>
          <h3 className="font-semibold text-ink mb-1">No startups yet</h3>
          <p className="text-sm text-muted mb-5">
            {canManage ? 'Add the first startup to this workspace.' : 'No startups have been added here yet.'}
          </p>
          {canManage && (
            <Link href={`/workspaces/${params.id}/projects/new`} className="btn-primary">
              <Icons.Plus /> Add Startup
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {/* Members section — admin only */}
      {canManage && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Icons.Users /> Members
              <span className="text-xs font-normal text-muted bg-stroke px-2 py-0.5 rounded-full">
                {workspace.members.length}
              </span>
            </h2>
            <Link
              href={`/workspaces/${params.id}/members`}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Manage
            </Link>
          </div>
          <div className="divide-y divide-stroke">
            {workspace.members.map(m => (
              <div key={m.user_id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{m.email}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Added {new Date(m.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                  style={{
                    background: m.role === 'owner' ? 'rgba(212,126,48,0.12)' : 'rgba(141,90,43,0.08)',
                    color: m.role === 'owner' ? '#D47E30' : '#8D5A2B',
                  }}
                >
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
