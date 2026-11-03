'use client'
import { useState } from 'react'
import { signOutAction } from '@/lib/auth-actions'

export function UserMenu({ email, firstName }: { email: string; firstName: string | null }) {
  const [open, setOpen] = useState(false)
  const initials = (firstName?.[0] ?? email[0]).toUpperCase()

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--ox)', color: 'var(--on-ox)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '700 13px var(--sans)', border: 'none', cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 198 }}
          />
          <div style={{
            position: 'absolute', right: 0, top: 42, zIndex: 199,
            background: 'var(--ground)', border: '1px solid var(--line)',
            borderRadius: 10, minWidth: 210,
            boxShadow: '0 8px 32px rgba(15,45,107,0.15)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              {firstName && (
                <p style={{ font: '600 13px var(--sans)', color: 'var(--text)', margin: '0 0 2px' }}>
                  {firstName}
                </p>
              )}
              <p style={{ font: '400 12px var(--sans)', color: 'var(--muted)', margin: 0 }}>{email}</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                style={{
                  width: '100%', padding: '11px 16px', textAlign: 'left',
                  font: '500 13px var(--sans)', color: 'var(--text)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
