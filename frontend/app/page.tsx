import { getAuthUser } from '@/lib/auth'
import HomeClient from '@/components/HomeClient'

export default async function Home() {
  const { user, isAdmin, signInUrl, signUpUrl } = await getAuthUser()
  return <HomeClient user={user} isAdmin={isAdmin} signInUrl={signInUrl} signUpUrl={signUpUrl} />
}
