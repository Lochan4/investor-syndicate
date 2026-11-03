'use client'
import { useState } from 'react'
import ProcessSection from '@/components/ProcessSection'
import { ApplySection } from '@/components/ApplySection'
import { UserMenu } from '@/components/UserMenu'

const FOUNDERS = [
  { initials: 'S', name: 'Srikanth', role: 'Industry veteran',      bio: 'A long career across the technology industry, now focused on spotting and backing new innovators.' },
  { initials: 'S', name: 'Sandeep',  role: 'Senior executive',      bio: 'A senior executive with deep experience running and scaling businesses.' },
  { initials: 'A', name: 'Ajith',    role: 'Seasoned entrepreneur', bio: 'An entrepreneur with vast experience building companies from the ground up.' },
]

type AuthUser = { email: string; firstName: string | null } | null

export default function HomeClient({
  user,
  isAdmin,
  signInUrl,
  signUpUrl,
}: {
  user: AuthUser
  isAdmin: boolean
  signInUrl: string | null
  signUpUrl: string | null
}) {
  const [applyOpen, setApplyOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  function openPitch() {
    if (user) {
      setApplyOpen(true)
    } else {
      setAuthOpen(true)
    }
  }

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
              <a
                href={signUpUrl as string}
                className="btn"
                style={{ justifyContent: 'center', textDecoration: 'none' }}
              >
                Create account
              </a>
              <a
                href={signInUrl as string}
                className="btn btn-outline"
                style={{ justifyContent: 'center', textDecoration: 'none' }}
              >
                Sign in
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Modal ── */}
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

      {/* ── Nav ── */}
      <div className="nav-shell">
        <div className="w">
          <nav>
            <a href="#" className="logo">QCI Club</a>
            <div className="nav-r">
              <a href="#process">How it works</a>
              <a href="/advisor">Advisors</a>
              <a href="/portfolio">Portfolio</a>
              <a href="/pitched">Pitched</a>
              <a href="/resources">Resources</a>
              <button onClick={openPitch} className="btn" style={{ cursor: 'pointer', border: 'none' }}>
                Pitch to us
              </button>
              {user ? (
                <UserMenu email={user.email} firstName={user.firstName} />
              ) : (
                <button onClick={() => setAuthOpen(true)} style={{ font: '500 14px var(--sans)', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Login
                </button>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* ── Hero ── */}
      <header className="hero">
        <div className="hero-l">
          <p className="eyebrow">Investors · Startups · Growth</p>
          <h1>
            {['Where','Change','Making','Investors','discover','Creative','Innovator'].map((w,i)=>(
              <span key={i} className="hero-word" style={{animationDelay:`${i*70}ms`}}>{w}</span>
            ))}
          </h1>
          <p>Access curated deals in AI, SaaS, and disruptive technologies. Join our network of 500+ investors backing the next unicorns.</p>
          <div className="hero-btns">
            <button onClick={openPitch} className="btn" style={{ cursor: 'pointer', border: 'none' }}>
              Apply →
            </button>
            <a href="/advisor" className="btn btn-outline">Meet the advisors</a>
          </div>
        </div>
        <aside className="hero-r">
          <p className="hero-network-label">QCI Club Network</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-val">2–4</span>
              <span className="hero-stat-label">Pitches heard per quarter</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-val">1–2 wk</span>
              <span className="hero-stat-label">Decision turnaround</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-val">US & India</span>
              <span className="hero-stat-label">Primary investment markets</span>
            </div>
          </div>
          <div className="hero-divider" />
          <div className="next">
            <p>Next pitch evening</p>
            <strong>Thursday, 14 November 2026</strong>
          </div>
        </aside>
      </header>

      {/* ── Process ── */}
      <ProcessSection />

      {/* ── Our Story ── */}
      <div className="adv-teaser-shell">
        <div className="w">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Our story</p>
          <h2 className="sec-h" style={{ marginBottom: 12 }}>The people behind QCI Club</h2>
          <p style={{ color: 'var(--muted)', maxWidth: '42em', lineHeight: 1.7, marginBottom: 48 }}>
            Decades of industry, executive and founder experience, brought together around one goal.
          </p>
          <div className="story-grid" style={{ marginBottom: 56 }}>
            {FOUNDERS.map(f => (
              <div key={f.name} style={{ background: 'var(--ground)', border: '1px solid var(--line)', borderRadius: 14, padding: '28px 24px', display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--ox)', color: 'var(--on-ox)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 26px/1 var(--serif)' }}>
                  {f.initials}
                </div>
                <div style={{ font: '600 10px var(--sans)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ox)' }}>{f.role}</div>
                <h3 style={{ font: '400 22px/1.1 var(--serif)', color: 'var(--text)', margin: 0 }}>{f.name}</h3>
                <p style={{ font: '400 14px/1.65 var(--sans)', color: 'var(--muted)', margin: 0 }}>{f.bio}</p>
              </div>
            ))}
          </div>
          {/* Vision quote */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 40, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
            <p className="eyebrow" style={{ paddingTop: 10 }}>Our vision</p>
            <blockquote style={{ margin: 0, font: '400 clamp(22px,2.6vw,32px)/1.3 var(--serif)', color: 'var(--text)', maxWidth: '28ch' }}>
              Bring like-minded people together around one common goal: to{' '}
              <em style={{ fontStyle: 'normal', color: 'var(--ox)' }}>encourage innovation and growth</em>{' '}
              in the younger generation.
            </blockquote>
          </div>
        </div>
      </div>

      {/* ── Founders CTA ── */}
      <div className="founders-shell">
        <div className="w">
          <h2>&ldquo;Pitch to a room that&rsquo;s already done the reading.&rdquo;</h2>
          <p>We don&rsquo;t take the meeting before we know the deck. Every founder who pitches has already been reviewed — which means the conversation goes deeper, faster, and without the small talk.</p>
          <button
            onClick={openPitch}
            className="btn btn-cream"
            style={{ cursor: 'pointer', border: 'none' }}
          >
            Apply →
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
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
