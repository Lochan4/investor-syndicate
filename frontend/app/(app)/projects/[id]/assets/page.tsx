import { withAuth } from '@workos-inc/authkit-nextjs'
import { AssetManager } from '@/components/AssetManager'
import { api } from '@/lib/api'

export default async function AssetsPage({ params }: { params: { id: string } }) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  let platformRole = 'investor'
  try { platformRole = (await api.getMe(accessToken!)).platform_role } catch {}
  return <AssetManager projectId={params.id} token={accessToken!} platformRole={platformRole} />
}
