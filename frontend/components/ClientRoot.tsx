'use client'
import { useEffect, useState } from 'react'
import LoadingScreen from './LoadingScreen'

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [done, setDone] = useState(false)

  // Mount after hydration to avoid SSR mismatch
  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      {mounted && !done && <LoadingScreen onDone={() => setDone(true)} />}
      {children}
    </>
  )
}
