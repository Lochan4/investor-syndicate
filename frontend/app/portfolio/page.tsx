'use client'
import { useState } from 'react'
import { ApplySection } from '@/components/ApplySection'

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  active:  { label: 'Active',  bg: 'rgba(21,128,61,0.1)',   color: '#15803D' },
  raising: { label: 'Raising', bg: 'rgba(252,179,3,0.12)',  color: '#92610A' },
  exited:  { label: 'Exited',  bg: 'rgba(15,45,107,0.08)',  color: '#0F2D6B' },
  closed:  { label: 'Closed',  bg: 'rgba(185,28,28,0.08)',  color: '#B91C1C' },
}

const COMPANIES = [
  {
    name: 'Company 1', sector: 'Enterprise Software',
    desc: 'Short description of what the company does and who it serves.',
    status: 'active', stage: 'Seed', invested: 'Oct 2026',
    update: 'Signed first two enterprise customers.', updated: 'Oct 2026',
  },
  {
    name: 'Company 2', sector: 'Healthcare and Pharma',
    desc: 'Short description of what the company does and who it serves.',
    status: 'raising', stage: 'Pre-seed', invested: 'Sep 2026',
    update: 'Raising the next round. The pilot with a hospital partner is now in its third month and has expanded from one ward to three. Early results show shorter wait times.',
    updated: 'Oct 2026',
  },
  {
    name: 'Company 3', sector: 'Cloud and Datacenters',
    desc: 'Short description of what the company does and who it serves.',
    status: 'active', stage: 'Seed', invested: 'Aug 2026',
    update: 'Product launched; growing month over month.', updated: 'Sep 2026',
  },
]

function Mono({ name }: { name: string }) {
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
      background: 'var(--ox)', color: 'var(--on-ox)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '700 16px var(--sans)',
    }}>
      {initials}
    </div>
  )
}

export default function PortfolioPage() {
  const [applyOpen, setApplyOpen] = useState(false)

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
              <a href="/pitched">Pitched</a>
              <a href="/resources">Resources</a>
              <button onClick={() => setApplyOpen(true)} className="btn" style={{ cursor: 'pointer', border: 'none', fontSize: 13, padding: '10px 18px' }}>Pitch to us</button>
            </div>
          </nav>
        </div>
      </div>

      <div style={{ background: 'var(--ox)', padding: '72px 0 64px' }}>
        <div className="w">
          <p className="eyebrow" style={{ color: 'var(--blush)', marginBottom: 20 }}>Portfolio · Our investments</p>
          <h1 style={{ font: '400 clamp(36px,4.8vw,64px)/1.06 var(--serif)', letterSpacing: '-.015em', color: 'var(--on-ox)', marginBottom: 20, maxWidth: '14em' }}>
            Companies we back.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--blush)', maxWidth: '48em', lineHeight: 1.65 }}>
            Each company was pitched to the club, scored by members, and approved by the investor panel.
          </p>
        </div>
      </div>

      <div style={{ padding: '72px 0 96px' }}>
        <div className="w">
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>{COMPANIES.length} companies</p>
          <div className="port-grid">
            {COMPANIES.map(c => {
              const st = STATUS[c.status]
              return (
                <article key={c.name} style={{
                  background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
                  padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <Mono name={c.name} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: '600 17px var(--sans)', color: 'var(--text)' }}>{c.name}</div>
                      <div style={{ font: '400 13px var(--sans)', color: 'var(--muted)', marginTop: 2 }}>{c.sector}</div>
                    </div>
                    <span style={{
                      font: '600 11.5px var(--sans)', padding: '4px 10px',
                      borderRadius: 999, flexShrink: 0,
                      background: st.bg, color: st.color,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                      {st.label}
                    </span>
                  </div>

                  <p style={{ font: '400 14px/1.65 var(--sans)', color: 'var(--muted)', flex: 1 }}>{c.desc}</p>

                  <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 14 }}>
                      {([['Stage', c.stage], ['Invested', c.invested]] as [string, string][]).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ font: '400 11px var(--sans)', color: 'var(--muted)', letterSpacing: '.02em' }}>{k}</div>
                          <div style={{ font: '600 13px var(--sans)', color: 'var(--text)', marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ font: '600 10px var(--sans)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                      Latest update · {c.updated}
                    </div>
                    <p style={{
                      font: '400 13px/1.55 var(--sans)', color: 'var(--text)', margin: 0,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                    }}>
                      {c.update}
                    </p>
                  </div>
                </article>
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
