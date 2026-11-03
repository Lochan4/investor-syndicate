import { withAuth, getSignInUrl, getSignUpUrl } from '@workos-inc/authkit-nextjs'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/auth'

export async function GET() {
  const { user } = await withAuth()
  if (!user) {
    const [signInUrl, signUpUrl] = await Promise.all([getSignInUrl(), getSignUpUrl()])
    return NextResponse.json({ user: null, isAdmin: false, signInUrl, signUpUrl })
  }
  return NextResponse.json({
    user: { email: user.email, firstName: user.firstName ?? null },
    isAdmin: isAdminEmail(user.email),
    signInUrl: null,
    signUpUrl: null,
  })
}
