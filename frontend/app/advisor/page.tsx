'use client'
import { useState } from 'react'
import { ApplySection } from '@/components/ApplySection'

const SECTORS = [
  {
    name: 'Retail',
    lead: { initials: 'CR', name: 'Cress', title: 'Sector Lead', bio: 'Leads retail reviews, looking at customer demand, unit economics and how a brand reaches its buyers.' },
    co: [],
  },
  {
    name: 'Enterprise Software',
    lead: { initials: 'AJ', name: 'Ajith', title: 'Advisor', bio: 'Reviews enterprise software pitches for product depth, sales motion and the path to recurring revenue. Serial entrepreneur with hands-on experience building startups from ideation through Series A across multiple verticals.' },
    co: [],
  },
  {
    name: 'Semiconductor and Hardware',
    lead: { initials: 'ST', name: 'Srikanth Tirumala', title: 'Co-Founder & Managing Partner', bio: 'Brings long industry experience to chip and hardware companies, from design choices to manufacturing risk. 30+ years of startup experience with multiple successful exits and deep roots in hardware and chip design.' },
    co: [],
  },
  {
    name: 'Healthcare and Pharma',
    lead: { initials: 'KI', name: 'Kiran', title: 'Sector Lead', bio: 'Leads healthcare and pharma reviews, weighing clinical value, regulation and time to market.' },
    co: [
      { initials: 'AP', name: 'Aparna', title: 'Co-Lead', bio: 'Adds perspective on patient outcomes and care delivery.' },
      { initials: 'BI', name: 'Bindu',  title: 'Co-Lead', bio: 'Adds perspective on research, trials and approvals.' },
    ],
  },
  {
    name: 'Telecom and Networking',
    lead: { initials: 'SU', name: 'Sunil', title: 'Sector Lead', bio: 'Reviews telecom and networking companies for technology fit, carrier relationships and scale.' },
    co: [
      { initials: 'SA', name: 'Sath',    title: 'Co-Lead', bio: 'Adds perspective on network infrastructure.' },
      { initials: 'MN', name: 'Manohar', title: 'Co-Lead', bio: 'Adds perspective on operations and go-to-market.' },
    ],
  },
  {
    name: 'Media and Entertainment',
    lead: { initials: 'HI', name: 'Hiren', title: 'Sector Lead', bio: 'Leads media and entertainment reviews, focusing on audience, content and monetization.' },
    co: [
      { initials: 'AJ', name: 'Ajith',  title: 'Co-Lead', bio: 'Adds perspective on digital platforms and distribution.' },
      { initials: 'MH', name: 'Mahesh', title: 'Co-Lead', bio: 'Adds perspective on content and creator economics.' },
    ],
  },
  {
    name: 'Cloud and Datacenters',
    lead: { initials: 'SD', name: 'Sandeep Damodaran', title: 'Co-Founder & Managing Partner', bio: 'A senior executive who reviews cloud and datacenter companies for architecture, cost and scale. 30-year veteran in enterprise technology with deep expertise in scaling SaaS businesses.' },
    co: [],
  },
  {
    name: 'Transport and Space Technology',
    lead: { initials: 'LE', name: 'Leon', title: 'Sector Lead', bio: 'Leads transport and space technology reviews, from mobility to launch and satellites.' },
    co: [],
  },
]

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
}

type Person = { initials: string; name: string; title: string; bio: string }

const Silhouette = () => (
  <svg
    viewBox="0 0 300 260"
    aria-hidden="true"
    style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 'auto', color: 'rgba(15,45,107,0.4)' }}
  >
    <circle cx="150" cy="105" r="58" fill="currentColor" />
    <path d="M28 260c6-62 58-98 122-98s116 36 122 98z" fill="currentColor" />
  </svg>
)

function Portrait({ initials, kind }: { initials: string; kind: 'lead' | 'co' }) {
  return (
    <div style={{
      width: kind === 'lead' ? 300 : 190, maxWidth: '100%',
      position: 'relative', aspectRatio: '3/4',
      borderRadius: 14, overflow: 'hidden',
      background: 'linear-gradient(170deg, #1A3D85 0%, #0F2D6B 85%)',
      ...(kind === 'lead' ? { boxShadow: '0 0 0 3px var(--ground), 0 0 0 5px var(--on-ox)' } : {}),
    }}>
      <Silhouette />
      <span style={{
        position: 'absolute', left: 14, top: 12,
        font: `700 ${kind === 'lead' ? 28 : 20}px/1 var(--serif)`,
        color: 'var(--on-ox)',
      }}>
        {initials}
      </span>
      {kind === 'lead' && (
        <span style={{ position: 'absolute', right: 10, top: 12, font: '500 9px var(--sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(252,179,3,0.55)' }}>
          Photo coming
        </span>
      )}
    </div>
  )
}


function PersonCard({ p, kind }: { p: Person; kind: 'lead' | 'co' }) {
  return (
    <article style={{ display: 'grid', gap: 12, alignContent: 'start', width: kind === 'lead' ? 300 : 190, maxWidth: '100%' }}>
      <Portrait initials={p.initials} kind={kind} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {kind === 'lead' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--on-ox)', display: 'inline-block', flexShrink: 0 }} />}
        <span style={{ font: '600 10px var(--sans)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ox)' }}>
          {kind === 'lead' ? 'Sector lead' : 'Co-lead'}
        </span>
      </div>
      <h3 style={{ font: `400 ${kind === 'lead' ? 26 : 19}px/1.1 var(--serif)`, color: 'var(--text)', margin: 0 }}>{p.name}</h3>
      <p style={{ font: `400 ${kind === 'lead' ? 15 : 14}px/1.65 var(--sans)`, color: 'var(--muted)', margin: 0 }}>{p.bio}</p>
    </article>
  )
}

export default function AdvisorPage() {
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
              <a href="/portfolio">Portfolio</a>
              <a href="/pitched">Pitched</a>
              <a href="/resources">Resources</a>
              <button onClick={() => setApplyOpen(true)} className="btn" style={{ cursor: 'pointer', border: 'none', fontSize: 13, padding: '10px 18px' }}>Pitch to us</button>
            </div>
          </nav>
        </div>
      </div>

      <div style={{ background: 'var(--ox)', padding: '80px 0 60px' }}>
        <div className="w">
          <p className="eyebrow" style={{ color: 'var(--blush)', marginBottom: 20 }}>Panel of Experts</p>
          <h1 style={{ font: '400 clamp(36px,4.8vw,64px)/1.06 var(--serif)', letterSpacing: '-.015em', color: 'var(--on-ox)', marginBottom: 20, maxWidth: '14em' }}>
            The people who review every pitch.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--blush)', maxWidth: '48em', lineHeight: 1.65, marginBottom: 32 }}>
            Each sector is led by a club member with deep experience in that field — on hand for every pitch and every portfolio company.
          </p>
          <nav aria-label="Jump to sector" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', padding: 0 }}>
            {SECTORS.map(s => (
              <a key={s.name} href={`#${slug(s.name)}`} style={{ font: '500 13px var(--sans)', color: 'rgba(252,179,3,0.8)', border: '1px solid rgba(252,179,3,0.25)', borderRadius: 999, padding: '6px 14px', textDecoration: 'none' }}>
                {s.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ padding: '72px 0 96px' }}>
        <div className="w">
          {SECTORS.map((s, i) => (
            <div key={s.name} id={slug(s.name)} className="sector-row">
              <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <span style={{ font: '600 11px var(--sans)', letterSpacing: '.12em', color: 'var(--muted)' }}>
                  Sector {String(i + 1).padStart(2, '0')} of {SECTORS.length}
                </span>
                <h2 style={{ font: '400 clamp(20px,2.2vw,28px)/1.2 var(--serif)', color: 'var(--text)', margin: 0 }}>{s.name}</h2>
                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--on-ox)' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
                <PersonCard p={s.lead} kind="lead" />
                {s.co.map(c => <PersonCard key={c.name + s.name} p={c} kind="co" />)}
              </div>
            </div>
          ))}
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
