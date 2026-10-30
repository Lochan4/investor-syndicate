'use client'
import { useState, useMemo } from 'react'
import { ApplySection } from '@/components/ApplySection'

type TabKey = 'experts' | 'demystify' | 'future' | 'quick'

const TABS: Array<{ key: TabKey; big: string; sub: string }> = [
  { key: 'experts',   big: 'Understand',  sub: 'from the experts' },
  { key: 'demystify', big: 'De-Mystify',  sub: 'startups and investments' },
  { key: 'future',    big: 'Analyze',     sub: 'the world and the future' },
  { key: 'quick',     big: 'Learn',       sub: 'quick and easy' },
]

const EXPERTS = [
  { title: 'QCI Club Intro Podcast',                     kind: 'Podcast',   category: 'About QCI Club',           date: '2026-09-08', people: ['QCI Club members'], dur: '—' },
  { title: 'What an investor panel looks for in a pitch', kind: 'Videocast', category: 'Investing',                date: '2026-10-14', people: ['Srikanth','Sandeep'], dur: '32:10' },
  { title: 'Building chips in a startup',                kind: 'Podcast',   category: 'Semiconductor and Hardware', date: '2026-10-02', people: ['Srikanth'],          dur: '41:25' },
  { title: 'From pilot to hospital-wide rollout',        kind: 'Videocast', category: 'Healthcare and Pharma',    date: '2026-09-22', people: ['Kiran','Aparna'],    dur: '28:40' },
  { title: 'Why networks still matter',                  kind: 'Podcast',   category: 'Telecom and Networking',   date: '2026-08-18', people: ['Sunil','Manohar'],   dur: '36:05' },
  { title: 'The economics of the cloud bill',            kind: 'Videocast', category: 'Cloud and Datacenters',    date: '2026-08-04', people: ['Sandeep'],           dur: '25:50' },
]

const DEMYSTIFY = [
  { title: 'How the QCI Club LLC works',         kind: 'Presentation', category: 'Club basics',  dur: '12 slides' },
  { title: 'What happens after you pitch',       kind: 'Quick video',  category: 'For founders', dur: '3:20' },
  { title: 'Pipelined LLCs, explained',          kind: 'Quick video',  category: 'Club basics',  dur: '4:05' },
  { title: 'How members score a startup',        kind: 'Presentation', category: 'Evaluation',   dur: '9 slides' },
  { title: 'Pre-seed, seed and Series A',        kind: 'Quick video',  category: 'Investing',    dur: '2:45' },
  { title: 'Reading a cap table',                kind: 'Quick video',  category: 'Investing',    dur: '4:50' },
]

const FUTURE = [
  { title: 'AI and the next decade of work',       category: 'Technology',                  dur: '27:30', people: 'Club panel',  summary: 'Which jobs change, which industries open up, and where startups have an edge.' },
  { title: 'Space is getting cheaper',             category: 'Transport and Space',          dur: '22:15', people: 'Leon',        summary: 'Falling launch costs and what new businesses become possible in orbit.' },
  { title: 'India and the US: two startup markets', category: 'Markets',                    dur: '18:40', people: 'Club panel',  summary: 'How founders, funding and exits differ between the two markets the club invests in.' },
]

const QUICK = [
  { title: 'What is an angel investor?', plat: 'Shorts',    dur: '0:24' },
  { title: 'Equity in one breath',       plat: 'Instagram', dur: '0:18' },
  { title: 'What is a K-1?',             plat: 'Shorts',    dur: '0:27' },
  { title: 'Pre-money vs post-money',    plat: 'Instagram', dur: '0:22' },
  { title: 'Why we decide in 2 weeks',   plat: 'Shorts',    dur: '0:15' },
]

// Deterministic gradient from title string using brand navies
const NAVIES = ['#0F2D6B','#1A3D85','#122B5E','#0D2550','#0A1E45']
function gradBg(s: string, deg = 150) {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = NAVIES[h % NAVIES.length], b = NAVIES[(h + 2) % NAVIES.length]
  return `linear-gradient(${deg}deg, ${a}, ${b})`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5v11l9-5.5z" fill="currentColor"/></svg>
)

export default function ResourcesPage() {
  const [applyOpen, setApplyOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('experts')
  const [catFilter, setCatFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [demyFilter, setDemyFilter] = useState('all')

  const cats    = useMemo(() => [...new Set(EXPERTS.map(e => e.category))].sort(), [])
  const dates   = useMemo(() => [...new Set(EXPERTS.map(e => e.date.slice(0, 7)))].sort().reverse(), [])
  const people  = useMemo(() => [...new Set(EXPERTS.flatMap(e => e.people))].sort(), [])
  const fmtMon  = (k: string) => new Date(k + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const filteredExperts = useMemo(() =>
    EXPERTS.filter(e =>
      (!catFilter    || e.category === catFilter) &&
      (!dateFilter   || e.date.startsWith(dateFilter)) &&
      (!personFilter || e.people.includes(personFilter))
    ).sort((a, b) => b.date.localeCompare(a.date)),
    [catFilter, dateFilter, personFilter]
  )

  const filteredDemy = DEMYSTIFY.filter(d => demyFilter === 'all' || d.kind === demyFilter)

  const selStyle: React.CSSProperties = {
    font: '400 14px var(--sans)', color: 'var(--text)',
    background: '#fff', border: '1px solid var(--line)', borderRadius: 8,
    padding: '9px 10px', width: '100%',
  }

  const thumbStyle = (title: string): React.CSSProperties => ({
    position: 'relative', aspectRatio: '16/9', width: '100%',
    background: gradBg(title), borderRadius: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  })

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  }

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
              <a href="/pitched">Pitched</a>
              <button onClick={() => setApplyOpen(true)} className="btn" style={{ cursor: 'pointer', border: 'none', fontSize: 13, padding: '10px 18px' }}>Pitch to us</button>
            </div>
          </nav>
        </div>
      </div>

      {/* Hero + tab bar */}
      <div style={{ background: 'var(--ox)' }}>
        <div className="w" style={{ padding: '72px 32px 0' }}>
          <p className="eyebrow" style={{ color: 'var(--blush)', marginBottom: 20 }}>Resources</p>
          <h1 style={{ font: '400 clamp(36px,4.8vw,64px)/1.06 var(--serif)', letterSpacing: '-.015em', color: 'var(--on-ox)', marginBottom: 20, maxWidth: '14em' }}>
            Learn with the club.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--blush)', maxWidth: '52em', lineHeight: 1.65, paddingBottom: 40 }}>
            Conversations with experts, plain-language explainers on startup investing, longer looks at where the world is heading, and quick learns under 30 seconds.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ borderTop: '1px solid rgba(252,179,3,0.2)', overflowX: 'auto' }}>
          <div className="w" style={{ padding: '0 32px', display: 'flex', gap: 4 }} role="tablist">
            {TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                style={{
                  font: 'inherit', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '16px 20px 14px', display: 'flex', flexDirection: 'column', gap: 3,
                  textAlign: 'left', flexShrink: 0,
                  borderBottom: tab === t.key ? '3px solid var(--on-ox)' : '3px solid transparent',
                  opacity: tab === t.key ? 1 : 0.6,
                  transition: 'opacity .15s, border-color .15s',
                }}
              >
                <span style={{ font: '400 clamp(18px,2vw,24px)/1 var(--serif)', color: 'var(--on-ox)', letterSpacing: '-.01em' }}>{t.big}</span>
                <span style={{ font: '500 12px var(--sans)', color: 'var(--blush)', whiteSpace: 'nowrap' }}>{t.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ background: 'var(--surface)', padding: '56px 0 96px' }}>
        <div className="w">

          {/* ── Tab 1: Experts ── */}
          {tab === 'experts' && (
            <div role="tabpanel">
              <h2 style={{ font: '400 clamp(24px,3vw,36px)/1.1 var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
                Understand from the Experts
              </h2>
              <p style={{ font: '400 15px var(--sans)', color: 'var(--muted)', marginBottom: 24 }}>
                Podcasts and videocasts with founders, investors and subject-matter experts.
              </p>

              {/* Filters */}
              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                {([
                  ['Category', catFilter,    setCatFilter,    cats,   (v: string) => v],
                  ['Date',     dateFilter,   setDateFilter,   dates,  fmtMon],
                  ['People',   personFilter, setPersonFilter, people, (v: string) => v],
                ] as [string, string, (v: string) => void, string[], (v: string) => string][]).map(([label, val, set, opts, fmt]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150, flex: 1 }}>
                    <label style={{ font: '600 11px var(--sans)', color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</label>
                    <select value={val} onChange={e => set(e.target.value)} style={selStyle}>
                      <option value="">All</option>
                      {opts.map(o => <option key={o} value={o}>{fmt(o)}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => { setCatFilter(''); setDateFilter(''); setPersonFilter('') }} style={{ font: '600 13px var(--sans)', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer' }}>
                    Clear
                  </button>
                </div>
              </div>

              <p style={{ font: '400 13px var(--sans)', color: 'var(--muted)', marginBottom: 16 }}>
                {filteredExperts.length} of {EXPERTS.length} episodes
              </p>
              <div className="res-cards">
                {filteredExperts.map(e => (
                  <article key={e.title} style={cardStyle}>
                    <div style={thumbStyle(e.title)}>
                      <span style={{ font: '600 10px var(--sans)', letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(15,45,107,0.7)', color: '#fff', padding: '3px 8px', borderRadius: 6, position: 'absolute', top: 10, left: 10 }}>{e.kind}</span>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--on-ox)', color: 'var(--ox)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayIcon /></div>
                      <span style={{ font: '600 11px var(--sans)', background: 'rgba(15,45,107,0.8)', color: '#fff', padding: '2px 7px', borderRadius: 6, position: 'absolute', bottom: 10, right: 10, fontVariantNumeric: 'tabular-nums' }}>{e.dur}</span>
                    </div>
                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <span style={{ font: '600 10px var(--sans)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ox)' }}>{e.category}</span>
                      <h3 style={{ font: '600 16px/1.25 var(--sans)', color: 'var(--text)' }}>{e.title}</h3>
                      <span style={{ font: '400 13px var(--sans)', color: 'var(--muted)' }}>{e.people.join(', ')} · {fmtDate(e.date)}</span>
                    </div>
                  </article>
                ))}
                {filteredExperts.length === 0 && (
                  <div style={{ gridColumn: '1/-1', border: '1.5px dashed var(--line)', borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                    No episodes match these filters.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 2: De-Mystify ── */}
          {tab === 'demystify' && (
            <div role="tabpanel">
              <h2 style={{ font: '400 clamp(24px,3vw,36px)/1.1 var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
                De-mystifying Startups &amp; Investments
              </h2>
              <p style={{ font: '400 15px var(--sans)', color: 'var(--muted)', marginBottom: 24 }}>
                Presentations and quick 2–5 minute videos that explain how startup investing works.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[['all','All'],['Presentation','Presentations'],['Quick video','Quick videos']].map(([val, label]) => (
                  <button key={val} onClick={() => setDemyFilter(val)} style={{
                    font: '600 13px var(--sans)', padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
                    background: demyFilter === val ? 'var(--ox)' : '#fff',
                    color: demyFilter === val ? 'var(--on-ox)' : 'var(--text)',
                    border: `1px solid ${demyFilter === val ? 'var(--ox)' : 'var(--line)'}`,
                  }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="res-cards">
                {filteredDemy.map(d => (
                  <article key={d.title} style={cardStyle}>
                    <div style={thumbStyle(d.title)}>
                      <span style={{ font: '600 10px var(--sans)', letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(15,45,107,0.7)', color: '#fff', padding: '3px 8px', borderRadius: 6, position: 'absolute', top: 10, left: 10 }}>{d.kind}</span>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--on-ox)', color: 'var(--ox)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayIcon /></div>
                      <span style={{ font: '600 11px var(--sans)', background: 'rgba(15,45,107,0.8)', color: '#fff', padding: '2px 7px', borderRadius: 6, position: 'absolute', bottom: 10, right: 10 }}>{d.dur}</span>
                    </div>
                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ font: '600 10px var(--sans)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ox)' }}>{d.category}</span>
                      <h3 style={{ font: '600 16px/1.25 var(--sans)', color: 'var(--text)' }}>{d.title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab 3: Future / Analyze ── */}
          {tab === 'future' && (
            <div role="tabpanel">
              <h2 style={{ font: '400 clamp(24px,3vw,36px)/1.1 var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
                Analyze the World &amp; Future Together
              </h2>
              <p style={{ font: '400 15px var(--sans)', color: 'var(--muted)', marginBottom: 28 }}>
                Long-format sessions of 15–30 minutes where we dig into one topic and what it means for the next decade.
              </p>
              <div className="res-long">
                {FUTURE.map(f => (
                  <article key={f.title} style={{ ...cardStyle, overflow: 'hidden' }}>
                    <div className="res-card-inner">
                      <div style={{ ...thumbStyle(f.title), aspectRatio: 'auto', minHeight: 180 }}>
                        <span style={{ font: '600 10px var(--sans)', letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(15,45,107,0.7)', color: '#fff', padding: '3px 8px', borderRadius: 6, position: 'absolute', top: 10, left: 10 }}>Long form</span>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--on-ox)', color: 'var(--ox)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayIcon /></div>
                        <span style={{ font: '600 11px var(--sans)', background: 'rgba(15,45,107,0.8)', color: '#fff', padding: '2px 7px', borderRadius: 6, position: 'absolute', bottom: 10, right: 10 }}>{f.dur}</span>
                      </div>
                      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                        <span style={{ font: '600 10px var(--sans)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ox)' }}>{f.category}</span>
                        <h3 style={{ font: '600 20px/1.25 var(--sans)', color: 'var(--text)' }}>{f.title}</h3>
                        <p style={{ font: '400 14px/1.65 var(--sans)', color: 'var(--muted)', margin: 0 }}>{f.summary}</p>
                        <span style={{ font: '400 13px var(--sans)', color: 'var(--muted)' }}>{f.people}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab 4: Quick ── */}
          {tab === 'quick' && (
            <div role="tabpanel">
              <h2 style={{ font: '400 clamp(24px,3vw,36px)/1.1 var(--serif)', color: 'var(--text)', marginBottom: 8 }}>
                Quick Learn
              </h2>
              <p style={{ font: '400 15px var(--sans)', color: 'var(--muted)', marginBottom: 28 }}>
                Shorts and Instagram videos under 30 seconds. One idea, explained fast.
              </p>
              <div className="res-shorts">
                {QUICK.map(q => (
                  <article key={q.title} style={{
                    borderRadius: 12, overflow: 'hidden', position: 'relative',
                    aspectRatio: '9/16', display: 'flex', flexDirection: 'column',
                    justifyContent: 'flex-end', padding: 14,
                    background: gradBg(q.title, 180),
                  }}>
                    <span style={{ font: '600 10px var(--sans)', letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '3px 8px', borderRadius: 6, position: 'absolute', top: 12, left: 12 }}>{q.plat}</span>
                    <span style={{ font: '600 11px var(--sans)', background: 'rgba(0,0,0,0.35)', color: '#fff', padding: '2px 7px', borderRadius: 6, position: 'absolute', top: 12, right: 12 }}>{q.dur}</span>
                    <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', width: 40, height: 40, borderRadius: '50%', background: 'var(--on-ox)', color: 'var(--ox)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayIcon /></div>
                    <div style={{ position: 'absolute', inset: '40% 0 0 0', background: 'linear-gradient(transparent, rgba(5,14,38,0.85))' }} />
                    <h3 style={{ font: '600 14px/1.25 var(--sans)', color: '#fff', position: 'relative', zIndex: 1 }}>{q.title}</h3>
                    <small style={{ font: '400 11px var(--sans)', color: 'rgba(255,255,255,0.7)', marginTop: 4, position: 'relative', zIndex: 1 }}>Coming soon</small>
                  </article>
                ))}
              </div>
            </div>
          )}

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
