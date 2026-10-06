'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icons } from './Icons'

const NAV = [
  { href: '/investments', label: 'Investments', icon: Icons.Chart },
  { href: '/dashboard',   label: 'Projects',    icon: Icons.Folder },
]

const CANVAS_EDITOR_ROLES = new Set(['super_admin', 'admin', 'developer'])

const DROPDOWN_ITEMS = [
  { href: '/settings',                       label: 'Admin Control' },
  { href: '/admin/settings/flow-template',   label: 'Edit Canvas' },
]

export function PillNav({ role }: { role?: string }) {
  const path = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const canEdit = CANVAS_EDITOR_ROLES.has(role ?? '')
  const settingsActive = path === '/settings' || path.startsWith('/admin/settings')

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '5px 6px',
        background: '#FEFCF5',
        borderRadius: 9999,
        border: '1px solid rgba(141,90,43,0.14)',
        boxShadow: '0 4px 24px rgba(141,90,43,0.13), 0 1px 4px rgba(141,90,43,0.07)',
      }}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 9999, fontSize: 13,
              fontWeight: active ? 700 : 500, textDecoration: 'none',
              transition: 'all 0.15s ease',
              background: active ? '#D47E30' : 'transparent',
              color: active ? '#FEFCF5' : '#8D5A2B',
            }}
          >
            <span style={{ display: 'flex', opacity: active ? 1 : 0.7 }}><Icon /></span>
            {label}
          </Link>
        )
      })}

      {canEdit && (
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 9999, fontSize: 13,
              fontWeight: settingsActive || open ? 700 : 500,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
              background: settingsActive || open ? '#D47E30' : 'transparent',
              color: settingsActive || open ? '#FEFCF5' : '#8D5A2B',
            }}
          >
            <span style={{ display: 'flex', opacity: settingsActive || open ? 1 : 0.7 }}>
              <Icons.Flow />
            </span>
            Settings
          </button>

          {open && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#FEFCF5',
              border: '1px solid rgba(141,90,43,0.14)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(141,90,43,0.18)',
              padding: '4px',
              minWidth: 170,
              zIndex: 100,
            }}>
              {DROPDOWN_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block', padding: '9px 14px', fontSize: 13,
                    fontWeight: 500, textDecoration: 'none', color: '#8D5A2B',
                    borderRadius: 8, transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(141,90,43,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {label}
                </Link>
              ))}
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 14px', fontSize: 13, fontWeight: 500,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#8D5A2B', borderRadius: 8, transition: 'background 0.1s',
                    borderTop: '1px solid rgba(141,90,43,0.1)', marginTop: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(141,90,43,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
