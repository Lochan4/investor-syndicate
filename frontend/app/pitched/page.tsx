'use client'
import { useState } from 'react'
import { ApplySection } from '@/components/ApplySection'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const PITCHES: Record<number, Record<number, Array<{ name: string; url: string }>>> = {
  2026: {
    10: [{ name: 'Pitched Company A', url: 'https://example.com' }, { name: 'Pitched Company B', url: 'https://example.com' }],
    9:  [{ name: 'Pitched Company C', url: 'https://example.com' }, { name: 'Pitched Company D', url: 'https://example.com' }, { name: 'Pitched Company E', url: 'https://example.com' }],
    7:  [{ name: 'Pitched Company F', url: 'https://example.com' }],
  },
  2025: {
    12: [{ name: 'Pitched Company G', url: 'https://example.com' }, { name: 'Pitched Company H', url: 'https://example.com' }],
    11: [{ name: 'Pitched Company I', url: 'https://example.com' }],
  },
}

function Mono({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: 9, flexShrink: 0,
      background: 'var(--ox)', color: 'var(--on-ox)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: `700 ${Math.round(size * 0.36)}px var(--sans)`,
    }}>
      {initials}
    </div>
  )
}

function getHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function PitchedPage() {
  const years = Object.keys(PITCHES).map(Number).sort((a, b) => b - a)
  const [openYears, setOpenYears] = useState<Set<number>>(new Set([years[0]]))
  const [applyOpen, setApplyOpen] = useState(false)

  const toggle = (y: number) => setOpenYears(prev => {
    const next = new Set(prev)
    next.has(y) ? next.delete(y) : next.add(y)
    return next
  })

  return (
    <>
      {applyOpen && (
        <div className="modal-overlay" onClick={() => setApplyOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setApplyOpen(false)} aria-label="Close">✕</button>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>Apply</p>
              <h2 style={{ font: '400 clamp(24px,3vw,36px)/1.1 var(--serif)', letterSpacing: '-.01em', color: 'var(--text)' }}>
                Submit your startup
              </h2>
            </div>
            <ApplySection />
          </div>
        </div>
      )}

      <div className="nav-shell">
        <div className="w">
          <nav>
            <a href="/" className="logo">QCI Club</a>
            <div className="nav-r">
              <a href="/#process">How it works</a>
              <a href="/advisor">Advisors</a>
              <a href="/portfolio">Portfolio</a>
              <a href="/resources">Resources</a>
              <button onClick={() => setApplyOpen(true)} className="btn" style={{ cursor: 'pointer', border: 'none', fontSize: 13, padding: '10px 18px' }}>Pitch to us</button>
            </div>
          </nav>
        </div>
      </div>

      <div style={{ background: 'var(--ox)', padding: '72px 0 64px' }}>
        <div className="w">
          <p className="eyebrow" style={{ color: 'var(--blush)', marginBottom: 20 }}>Pitched companies</p>
          <h1 style={{ font: '400 clamp(36px,4.8vw,64px)/1.06 var(--serif)', letterSpacing: '-.015em', color: 'var(--on-ox)', marginBottom: 20, maxWidth: '14em' }}>
            Founders who pitched to the club.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--blush)', maxWidth: '48em', lineHeight: 1.65 }}>
            We hear 3–4 startup pitches every quarter. Every company that has pitched, by the month they presented.
          </p>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', padding: '72px 0 96px' }}>
        <div className="w">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24 }}>
            {[['Expand all', () => setOpenYears(new Set(years))], ['Collapse all', () => setOpenYears(new Set())]].map(([label, fn]) => (
              <button key={label as string} onClick={fn as () => void} style={{
                font: '600 13px var(--sans)', color: 'var(--text)',
                background: '#fff', border: '1px solid var(--line)',
                borderRadius: 999, padding: '7px 16px', cursor: 'pointer',
              }}>
                {label as string}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {years.map(y => {
              const isOpen = openYears.has(y)
              const monthKeys = Object.keys(PITCHES[y]).map(Number).sort((a, b) => b - a)
              const total = monthKeys.reduce((n, m) => n + PITCHES[y][m].length, 0)
              return (
                <div key={y} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                  <button
                    onClick={() => toggle(y)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                      padding: '20px 24px', cursor: 'pointer', border: 'none', textAlign: 'left',
                      background: isOpen ? 'var(--ox)' : '#fff',
                      transition: 'background .15s',
                    }}
                  >
                    <span style={{ font: '400 clamp(26px,2.8vw,34px)/1 var(--serif)', letterSpacing: '-.01em', color: isOpen ? 'var(--on-ox)' : 'var(--text)' }}>{y}</span>
                    <span style={{ font: '400 13px var(--sans)', color: isOpen ? 'var(--blush)' : 'var(--muted)' }}>
                      {total} {total === 1 ? 'company' : 'companies'} · {monthKeys.length} {monthKeys.length === 1 ? 'month' : 'months'}
                    </span>
                    <span style={{
                      marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: isOpen ? 'rgba(252,179,3,0.2)' : 'var(--surface)',
                      color: isOpen ? 'var(--on-ox)' : 'var(--muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform .2s',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '8px 24px 24px' }}>
                      {monthKeys.map((m, i) => (
                        <div key={m} className="pitch-month" style={i === 0 ? { borderTop: 'none', paddingTop: 16 } : {}}>
                          <div>
                            <div style={{ font: '400 18px var(--serif)', color: 'var(--text)' }}>{MONTHS[m - 1]}</div>
                            <div style={{ font: '600 10px var(--sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>
                              {PITCHES[y][m].length} pitched
                            </div>
                          </div>
                          <div className="pitch-logos">
                            {PITCHES[y][m].map(c => (
                              <a
                                key={c.name} href={c.url} target="_blank" rel="noopener"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                                  border: '1px solid var(--line)', borderRadius: 10, textDecoration: 'none',
                                  color: 'var(--text)', transition: 'border-color .15s',
                                }}
                              >
                                <Mono name={c.name} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ font: '600 13px var(--sans)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                  <div style={{ font: '400 11px var(--sans)', color: 'var(--muted)', marginTop: 2 }}>{getHost(c.url)} ↗</div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="foot-shell">
        <div className="w">
          <footer className="foot">
            <span>QCI Club</span>
            <a href="mailto:hello@qciclub.com">hello@qciclub.com</a>
          </footer>
        </div>
      </div>
    </>
  )
}
