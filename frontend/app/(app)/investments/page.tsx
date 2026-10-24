import { withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { api, Investment } from '@/lib/api'
import { StatusBadge } from '@/components/StatusBadge'
import { Icons } from '@/components/Icons'
import Link from 'next/link'

function ctaHref(inv: Investment) {
  if (inv.status === 'open') return `/projects/${inv.id}/flow`
  return `/projects/${inv.id}`
}

function ctaLabel(inv: Investment) {
  if (inv.status === 'final') return 'View Report'
  if (inv.status === 'open') return 'Continue'
  return 'View'
}

export default async function InvestmentsPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let investments: Investment[] = []
  let platformRole = 'investor'
  let error = false
  try {
    const [inv, me] = await Promise.all([api.listInvestments(accessToken!), api.getMe(accessToken!)])
    investments = inv
    platformRole = me.platform_role
  } catch { error = true }

  if (platformRole === 'investor') redirect('/investor')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">My Investments</h1>
        <p className="page-subtitle mt-1">Projects you have been added to as an investor</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
          Failed to load investments.
        </div>
      )}

      {!error && investments.length === 0 && (
        <div className="card text-center py-16">
          <div className="inline-flex p-3 bg-stroke rounded-xl mb-4 text-muted">
            <Icons.Chart />
          </div>
          <h3 className="font-semibold text-ink mb-1">No investments yet</h3>
          <p className="text-sm text-muted">You haven't been added to any projects.</p>
        </div>
      )}

      {investments.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-background">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Company</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Sector</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Stage</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {investments.map(inv => (
                <tr key={inv.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-ink">{inv.startup_name}</td>
                  <td className="px-5 py-3.5 text-muted">{inv.sector ?? '—'}</td>
                  <td className="px-5 py-3.5 text-muted">{inv.stage ?? '—'}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={ctaHref(inv)} className="btn-ghost text-xs px-3 py-1.5">
                      {ctaLabel(inv)} <Icons.ChevronRight />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
