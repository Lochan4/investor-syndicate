import { withAuth } from '@workos-inc/authkit-nextjs'
import { api, Application } from '@/lib/api'
import { Icons } from '@/components/Icons'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted:  { bg: 'rgba(217,119,6,0.1)',   color: '#B45309' },
  reviewing:  { bg: 'rgba(59,130,246,0.1)',   color: '#1D4ED8' },
  added:      { bg: 'rgba(34,197,94,0.1)',    color: '#15803D' },
  rejected:   { bg: 'rgba(239,68,68,0.1)',    color: '#B91C1C' },
}

export default async function InboxPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const me = await api.getMe(accessToken!)
  if (!['super_admin', 'admin'].includes(me.platform_role)) redirect('/workspaces')

  let applications: Application[] = []
  let error = false
  try { applications = await api.listApplications(accessToken!) } catch { error = true }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">Applications</h1>
        <p className="page-subtitle mt-1">Startup applications submitted through the public form</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
          Failed to load applications.
        </div>
      )}

      {!error && applications.length === 0 && (
        <div className="card text-center py-16">
          <div className="inline-flex p-3 bg-stroke rounded-xl mb-4 text-muted">
            <Icons.List />
          </div>
          <h3 className="font-semibold text-ink mb-1">No applications yet</h3>
          <p className="text-sm text-muted">
            Share the <Link href="/apply" className="text-amber underline">/apply</Link> link with founders to start receiving submissions.
          </p>
        </div>
      )}

      {applications.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-background">
                {['Company', 'Founder', 'Sector', 'Stage', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {applications.map(app => {
                const style = STATUS_STYLES[app.status] ?? STATUS_STYLES.submitted
                return (
                  <tr key={app.id} className="hover:bg-background/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-ink">{app.startup_name}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-ink">{app.founder_name}</div>
                      <div className="text-xs text-muted">{app.founder_email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-muted">{app.sector ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted">{app.stage ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                        style={style}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted text-xs">
                      {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/admin/inbox/${app.id}`} className="btn-ghost text-xs px-3 py-1.5">
                        Review <Icons.ChevronRight />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
