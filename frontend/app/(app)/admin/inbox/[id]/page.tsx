import { withAuth } from '@workos-inc/authkit-nextjs'
import { api, Application, Workspace } from '@/lib/api'
import { Icons } from '@/components/Icons'
import { AddToWorkspaceButton } from '@/components/AddToWorkspaceButton'
import { ApplicationActions } from '@/components/ApplicationActions'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted:  { bg: 'rgba(217,119,6,0.1)',   color: '#B45309' },
  reviewing:  { bg: 'rgba(59,130,246,0.1)',   color: '#1D4ED8' },
  added:      { bg: 'rgba(34,197,94,0.1)',    color: '#15803D' },
  rejected:   { bg: 'rgba(239,68,68,0.1)',    color: '#B91C1C' },
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  )
}

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const me = await api.getMe(accessToken!)
  if (!['super_admin', 'admin'].includes(me.platform_role)) redirect('/workspaces')

  let app: Application | null = null
  let workspaces: Workspace[] = []
  try {
    const [a, ws] = await Promise.all([
      api.getApplication(accessToken!, params.id),
      api.listWorkspaces(accessToken!),
    ])
    app = a; workspaces = ws
  } catch (err: any) {
    if (err?.message?.includes('404')) notFound()
  }

  if (!app) notFound()

  const style = STATUS_STYLES[app.status] ?? STATUS_STYLES.submitted

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back */}
      <Link href="/admin/inbox" className="btn-ghost text-xs px-3 py-1.5 mb-6 inline-flex">
        <Icons.ArrowLeft /> Back to Applications
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">{app.startup_name}</h1>
          {app.one_liner && <p className="page-subtitle mt-1">{app.one_liner}</p>}
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full capitalize mt-1"
          style={style}>
          {app.status}
        </span>
      </div>

      {/* Details card */}
      <div className="card mb-6">
        <h2 className="font-semibold text-ink mb-4">Application Details</h2>
        <div className="grid grid-cols-2 gap-5">
          <Field label="Founder" value={app.founder_name} />
          <Field label="Email" value={app.founder_email} />
          <Field label="Sector" value={app.sector} />
          <Field label="Stage" value={app.stage} />
          <Field label="Website" value={app.website} />
          <Field label="Submitted" value={new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
        </div>
        {app.one_liner && (
          <div className="mt-5 pt-5 border-t border-stroke">
            <Field label="One-liner" value={app.one_liner} />
          </div>
        )}
      </div>

      {/* Pitch deck */}
      {app.pitch_doc_key && (
        <div className="card mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stroke rounded-lg"><Icons.File /></div>
            <div>
              <p className="text-sm font-medium text-ink">{app.pitch_doc_name ?? 'Pitch Deck'}</p>
              <p className="text-xs text-muted">Pitch document</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {app.status !== 'added' && app.status !== 'rejected' && (
        <div className="card mb-6">
          <h2 className="font-semibold text-ink mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3 items-start">
            <ApplicationActions token={accessToken!} appId={app.id} status={app.status} />
            <AddToWorkspaceButton token={accessToken!} appId={app.id} workspaces={workspaces} />
          </div>
        </div>
      )}

      {app.status === 'added' && app.project_id && (
        <div className="card border-green-200 bg-green-50/30">
          <p className="text-sm font-semibold text-green-800 mb-1">Added to workspace</p>
          <p className="text-xs text-green-700 mb-3">This startup has been added as a project.</p>
          <Link href={`/projects/${app.project_id}`} className="btn-ghost text-xs px-3 py-1.5">
            Open Project <Icons.ChevronRight />
          </Link>
        </div>
      )}

      {app.status === 'rejected' && (
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
          <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Application Rejected</p>
          <p className="text-xs text-muted mt-1">This application was rejected and will not be added to a workspace.</p>
        </div>
      )}
    </div>
  )
}
