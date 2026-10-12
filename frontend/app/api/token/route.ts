import { withAuth } from '@workos-inc/authkit-nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  return NextResponse.json({ token: accessToken })
}
