import { withAuth } from '@workos-inc/authkit-nextjs'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/StatusBadge'
import { Icons } from '@/components/Icons'
import { CompetitiveScanButton } from '@/components/CompetitiveScanButton'
import { OpenCanvasButton } from '@/components/OpenCanvasButton'
import { InviteButton } from '@/components/InviteButton'
import { DeleteProjectButton } from '@/components/DeleteProjectButton'
import Link from 'next/link'

export default async function ProjectHubPage({ params }: { params: { id: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let project: any = null
  let error = false
  let canDelete = false
  let canInvite = false
  try {
    const [proj, me] = await Promise.all([
      api.getProject(accessToken!, params.id),
      api.getMe(accessToken!),
    ])
    project = proj
    canInvite = me.can_edit_canvas
    canDelete = me.can_edit_canvas
  } catch {
    error = true
  }

  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
        Failed to load project. It may not exist or you may not have access.
      </div>
    </div>
  )

  const nav = [
    { label: 'Assets',      href: `/projects/${params.id}/assets`, icon: Icons.Upload, desc: 'Upload & manage files' },
    { label: 'Flow Canvas', href: `/projects/${params.id}/flow`,   icon: Icons.Flow,   desc: 'Visual investment flow' },
  ]

  const isDraft = project?.status === 'draft' || project?.status === 'pending'

  return (
    <div className="p-8 max-w-5xl mx-auto" data-testid="project-hub">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title mb-2">{project?.startup_name ?? 'Project'}</h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={project?.status ?? 'draft'} />
            {project?.sector && <span className="text-xs font-medium bg-amber-600/10 text-amber-600 px-2.5 py-1 rounded-full">{project.sector}</span>}
            {project?.stage  && <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{project.stage}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && (
            <OpenCanvasButton token={accessToken!} projectId={params.id} />
          )}
          <CompetitiveScanButton token={accessToken!} projectId={params.id} />
          {canDelete && (
            <DeleteProjectButton token={accessToken!} projectId={params.id} projectName={project?.startup_name ?? 'this project'} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {nav.map(({ label, href, icon: Icon, desc }) => (
          <Link key={label} href={href}
            className="card card-hover flex flex-col gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-150">
              <Icon />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Competitive scan uses Serper web search + Claude to generate a competitor landscape report.
      </p>

      {canInvite && <InviteButton token={accessToken!} projectId={params.id} />}
    </div>
  )
}
