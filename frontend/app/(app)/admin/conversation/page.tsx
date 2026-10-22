import { withAuth } from '@workos-inc/authkit-nextjs'
import { AdminConversationCanvas } from './AdminConversationClient'

export default async function AdminConversationPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  return <AdminConversationCanvas token={accessToken!} />
}
