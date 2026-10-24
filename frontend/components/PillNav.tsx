'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icons } from './Icons'

const CANVAS_EDITOR_ROLES = new Set(['super_admin', 'admin', 'developer'])

export function PillNav({ role }: { role?: string }) {
  const path = usePathname() ?? ''
  const [hovered, setHovered] = useState(false)
  const canEdit = CANVAS_EDITOR_ROLES.has(role ?? '')
  const settingsActive = path === '/settings' || path.startsWith('/admin/settings') || path.startsWith('/financier')
  const convActive = path === '/admin/conversation' || path.startsWith('/admin/conversation')

  // Auto-hide on activity conversation pages — show only on hover
  const autoHide = /\/projects\/[^/]+\/flow\/[^/]+/.test(path)
  const visible = !autoHide || hovered

  if (!canEdit) return null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        padding: '16px 40px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '5px 6px',
          background: '#FEFCF5',
          borderRadius: 9999,
          border: '1px solid rgba(141,90,43,0.14)',
          boxShadow: '0 4px 24px rgba(141,90,43,0.13), 0 1px 4px rgba(141,90,43,0.07)',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      >
        {/* Conversation */}
        <Link
          href="/admin/conversation"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 18px', borderRadius: 9999, fontSize: 13,
            fontWeight: convActive ? 700 : 500, textDecoration: 'none',
            transition: 'all 0.15s ease',
            background: convActive ? '#D47E30' : 'transparent',
            color: convActive ? '#FEFCF5' : '#8D5A2B',
          }}
        >
          <span style={{ display: 'flex', opacity: convActive ? 1 : 0.7 }}><Icons.Chat /></span>
          Conversation
        </Link>

        {/* Settings — direct link, no dropdown */}
        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 18px', borderRadius: 9999, fontSize: 13,
            fontWeight: settingsActive ? 700 : 500, textDecoration: 'none',
            transition: 'all 0.15s ease',
            background: settingsActive ? '#D47E30' : 'transparent',
            color: settingsActive ? '#FEFCF5' : '#8D5A2B',
          }}
        >
          <span style={{ display: 'flex', opacity: settingsActive ? 1 : 0.7 }}>
            <Icons.Flow />
          </span>
          Settings
        </Link>
      </div>
    </div>
  )
}
