import { withAuth, getSignInUrl, getSignUpUrl } from '@workos-inc/authkit-nextjs'

const ADMIN_EMAILS = (process.env.QCI_ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function getAuthUser() {
  const { user } = await withAuth()
  if (!user) {
    const [signInUrl, signUpUrl] = await Promise.all([getSignInUrl(), getSignUpUrl()])
    return { user: null, isAdmin: false, signInUrl, signUpUrl }
  }
  return {
    user: { email: user.email, firstName: user.firstName ?? null },
    isAdmin: isAdminEmail(user.email),
    signInUrl: null,
    signUpUrl: null,
  }
}
