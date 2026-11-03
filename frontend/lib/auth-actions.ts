'use server'
import { signOut } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  await signOut()
  redirect('/')
}
