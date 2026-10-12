'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icons } from './Icons'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Icons.Folder },
  { href: '/investments', label: 'My Investments', icon: Icons.Chart },
]

export function Sidebar({ role }: { role?: string }) {
  const path = usePathname() ?? ''
  return (
    <aside className="w-60 min-h-screen flex flex-col bg-navy shrink-0" style={{ boxShadow: '1px 0 0 0 #1E293B' }}>
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-navy-light/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-amber flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" fill="white" opacity="0.9"/>
              <path d="M7 4L9.5 5.5V8.5L7 10L4.5 8.5V5.5L7 4Z" fill="white"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight" style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', Arial, sans-serif" }}>Syndicate</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="section-header text-navy-muted px-3 mb-2">Navigation</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href))
          return (
            <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              active
                ? 'bg-amber text-white'
                : 'text-slate-400 hover:bg-navy-light hover:text-white'
            }`}>
              <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-500'}`}><Icon /></span>
              {label}
            </Link>
          )
        })}

        {['super_admin', 'admin', 'developer'].includes(role ?? '') && (
          <>
            <p className="section-header text-navy-muted px-3 mt-4 mb-2">Admin</p>
            <Link href="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              path.startsWith('/settings') ? 'bg-amber text-white' : 'text-slate-400 hover:bg-navy-light hover:text-white'
            }`}>
              <span className={`shrink-0 ${path.startsWith('/settings') ? 'text-white' : 'text-slate-500'}`}><Icons.Flow /></span>
              Settings
            </Link>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-navy-light/60 space-y-2">
        <Link href="/projects/new" className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-all duration-150">
          <Icons.Plus /> New Project
        </Link>
      </div>
    </aside>
  )
}
