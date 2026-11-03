'use client'
import { useEffect, useState } from 'react'
import { UserMenu } from '@/components/UserMenu'

type AuthState = {
  user: { email: string; firstName: string | null } | null
  signInUrl: string | null
  signUpUrl: string | null
}

export function NavAuth() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(setAuth)
  }, [])

  if (!auth) return null

  return (
    <>
      {/* ── Auth Gate Modal ── */}
      {authOpen && (
        <div className="modal-overlay" onClick={() => setAuthOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
            <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close">✕</button>
            <div style={{ marginBottom: 28 }}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>Access required</p>
              <h2 style={{ font: '400 clamp(22px,2.8vw,32px)/1.1 var(--serif)', letterSpacing: '-.01em', color: 'var(--text)', marginBottom: 10 }}>
                Sign in to pitch your startup
              </h2>
              <p style={{ font: '400 14px/1.65 var(--sans)', color: 'var(--muted)' }}>
                Create a free account or sign in to submit your application to QCI Club.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href={auth.signUpUrl as string} className="btn" style={{ justifyContent: 'center', textDecoration: 'none' }}>
                Create account
              </a>
              <a href={auth.signInUrl as string} className="btn btn-outline" style={{ justifyContent: 'center', textDecoration: 'none' }}>
                Sign in
              </a>
            </div>
          </div>
        </div>
      )}

      {auth.user ? (
        <UserMenu email={auth.user.email} firstName={auth.user.firstName} />
      ) : (
        <button
          onClick={() => setAuthOpen(true)}
          style={{ font: '500 14px var(--sans)', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Login
        </button>
      )}
    </>
  )
}
