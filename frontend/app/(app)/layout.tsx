import { withAuth } from '@workos-inc/authkit-nextjs'
import { PillNav } from '@/components/PillNav'
import { UserMenu } from '@/components/UserMenu'
import { BackButton } from '@/components/BackButton'
import { api } from '@/lib/api'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = await withAuth({ ensureSignedIn: true })
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'IN'
  let platformRole = 'investor'
  try { platformRole = (await api.getMe(accessToken!)).platform_role } catch {}

  const isInvestor = platformRole === 'investor'

  if (isInvestor) {
    // Investors: zero chrome — pages manage their own navigation
    return (
      <div className="min-h-screen bg-background">
        <main style={{ padding: 0 }}>{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back button — fixed top-left */}
      <div style={{ position: 'fixed', top: 16, left: 20, zIndex: 50, display: 'flex', alignItems: 'center' }}>
        <BackButton />
      </div>

      {/* Simplified admin pill nav */}
      <PillNav role={platformRole} />

      {/* Avatar — fixed top-right */}
      <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 50, display: 'flex', alignItems: 'center' }}>
        <UserMenu initials={initials} />
      </div>

      {/* Page content — top padding clears the fixed pill */}
      <main style={{ paddingTop: 80 }}>{children}</main>
    </div>
  )
}
