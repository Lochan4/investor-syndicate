import { withAuth } from '@workos-inc/authkit-nextjs'
import { api, Workspace } from '@/lib/api'
import { Icons } from '@/components/Icons'
import Link from 'next/link'

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'developer'])

export default async function WorkspacesPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let workspaces: Workspace[] = []
  let platformRole = 'investor'
  let error = false
  try {
    const [ws, me] = await Promise.all([
      api.listWorkspaces(accessToken!),
      api.getMe(accessToken!),
    ])
    workspaces = ws
    platformRole = me.platform_role
  } catch {
    error = true
  }

  const canCreate = ADMIN_ROLES.has(platformRole)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Workspaces</h1>
          <p className="page-subtitle mt-1">Select a workspace to view its startups</p>
        </div>
        {canCreate && (
          <Link href="/workspaces/new" className="btn-primary">
            <Icons.Plus /> New Workspace
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
          Could not connect to the API. Make sure the backend is running.
        </div>
      )}

      {!error && workspaces.length === 0 && (
        <div className="card text-center py-16">
          <div className="inline-flex p-3 bg-stroke rounded-xl mb-4 text-muted">
            <Icons.Workspace />
          </div>
          <h3 className="font-semibold text-ink mb-1">No workspaces yet</h3>
          <p className="text-sm text-muted mb-5">
            {canCreate ? 'Create a workspace to start organising startups.' : 'You have not been added to any workspaces yet.'}
          </p>
          {canCreate && (
            <Link href="/workspaces/new" className="btn-primary">
              <Icons.Plus /> Create Workspace
            </Link>
          )}
        </div>
      )}

      {workspaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map(ws => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="card card-hover block animate-fade-in group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber/10 text-amber shrink-0 mt-0.5">
                  <Icons.Workspace />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink text-[15px] leading-snug group-hover:text-amber transition-colors duration-150 truncate">
                    {ws.name}
                  </h3>
                  {ws.description && (
                    <p className="text-sm text-muted mt-0.5 line-clamp-2">{ws.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Icons.Users />
                  {ws.member_count ?? 0} {ws.member_count === 1 ? 'member' : 'members'}
                </span>
                <span className="text-xs text-amber font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
