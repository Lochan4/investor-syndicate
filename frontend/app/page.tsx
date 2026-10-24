'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ─── constants ───────────────────────────────────────────────────────────────

const FLIP_WORDS = ['DECIDE', 'CONTEMPLATE', 'CONTROL']

const SCRAMBLE_CHARS =
  '01アイウエオ0123456789ABCDEFGHIJKLMNabcdefghijklmn$%#×±≈∑π0.12 IRR NPV TAM SAM SOM LTV CAC MRR ARR'

const CLUSTERS = [
  {
    id: 'pitch',
    label: 'Pitch Deck',
    x: 450,
    y: 112,
    color: '#D97706',
    delay: 0,
    leaves: [
      { id: 'p1', label: 'Vision', x: 325, y: 50 },
      { id: 'p2', label: 'Product', x: 450, y: 34 },
      { id: 'p3', label: 'Traction', x: 575, y: 50 },
    ],
  },
  {
    id: 'founders',
    label: 'Founders',
    x: 640,
    y: 240,
    color: '#3B82F6',
    delay: 0.7,
    leaves: [
      { id: 'f1', label: 'CEO Profile', x: 750, y: 175 },
      { id: 'f2', label: 'Track Record', x: 772, y: 262 },
      { id: 'f3', label: 'Team Size', x: 708, y: 338 },
    ],
  },
  {
    id: 'market',
    label: 'Market',
    x: 588,
    y: 458,
    color: '#22C55E',
    delay: 1.4,
    leaves: [
      { id: 'm1', label: 'TAM $2.4T', x: 678, y: 516 },
      { id: 'm2', label: 'SAM $180B', x: 572, y: 540 },
      { id: 'm3', label: 'SOM $12B', x: 458, y: 516 },
    ],
  },
  {
    id: 'moat',
    label: 'Moat',
    x: 312,
    y: 458,
    color: '#8B5CF6',
    delay: 2.1,
    leaves: [
      { id: 'mo1', label: 'IP / Patents', x: 222, y: 516 },
      { id: 'mo2', label: 'Network FX', x: 328, y: 540 },
      { id: 'mo3', label: 'Data Moat', x: 442, y: 516 },
    ],
  },
  {
    id: 'comp',
    label: 'Competitors',
    x: 260,
    y: 240,
    color: '#F97316',
    delay: 2.8,
    leaves: [
      { id: 'c1', label: 'Direct Rivals', x: 142, y: 175 },
      { id: 'c2', label: 'Indirect', x: 122, y: 262 },
      { id: 'c3', label: 'Threat Level', x: 190, y: 338 },
    ],
  },
]

// ─── ScrambleCanvas ──────────────────────────────────────────────────────────

function ScrambleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    let raf: number
    let drops: number[] = []
    const FS = 12

    const init = () => {
      c.width = c.offsetWidth
      c.height = c.offsetHeight
      const cols = Math.floor(c.width / FS)
      drops = Array.from({ length: cols }, () => (Math.random() * -c.height) / FS)
    }

    init()

    const draw = () => {
      // Light cream fade — lower opacity = less erasure = heavier, more persistent trails
      ctx.fillStyle = 'rgba(252, 250, 244, 0.07)'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.font = `${FS}px 'Courier New', monospace`

      for (let i = 0; i < drops.length; i++) {
        const ch = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        const bright = Math.random() > 0.94
        // Darker amber so it reads on a light background
        ctx.fillStyle = bright ? 'rgba(180,95,5,0.82)' : 'rgba(180,95,5,0.26)'
        ctx.fillText(ch, i * FS, drops[i] * FS)
        if (drops[i] * FS > c.height && Math.random() > 0.975) drops[i] = 0
        drops[i] += 0.45
      }

      raf = requestAnimationFrame(draw)
    }

    draw()

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      init()
      draw()
    })
    if (c.parentElement) ro.observe(c.parentElement)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}

// ─── FlipWord ─────────────────────────────────────────────────────────────────

function FlipWord() {
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'show' | 'hide'>('show')

  useEffect(() => {
    const cycle = () => {
      setPhase('hide')
      setTimeout(() => {
        setIdx((i) => (i + 1) % FLIP_WORDS.length)
        setPhase('show')
      }, 320)
    }
    const id = setInterval(cycle, 2800)
    return () => clearInterval(id)
  }, [])

  return (
    <span
      style={{
        color: '#D97706',
        display: 'inline-block',
        minWidth: '16rem',
        textAlign: 'center',
        transform:
          phase === 'hide'
            ? 'rotateX(78deg) scaleY(0.5) translateY(-6px)'
            : 'rotateX(0deg) scaleY(1) translateY(0)',
        opacity: phase === 'hide' ? 0 : 1,
        transition:
          phase === 'hide'
            ? 'transform 0.28s ease-in, opacity 0.2s ease-in'
            : 'transform 0.38s cubic-bezier(0.34,1.36,0.64,1), opacity 0.3s ease-out',
        transformOrigin: '50% 0%',
      }}
    >
      {FLIP_WORDS[idx]}
    </span>
  )
}

// Pentagon cross-cluster edges (hub → next hub, clockwise)
const CROSS_EDGES = [
  { from: 'pitch', to: 'founders' },
  { from: 'founders', to: 'market' },
  { from: 'market', to: 'moat' },
  { from: 'moat', to: 'comp' },
  { from: 'comp', to: 'pitch' },
]

// Quadratic bezier curved outward from center
function spokeCurve(x1: number, y1: number, x2: number, y2: number, bend = 32) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  return `M ${x1},${y1} Q ${mx - dy / len * bend},${my + dx / len * bend} ${x2},${y2}`
}

// Cross edges curve away from center (450,292)
function crossCurve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const cx = mx - 450, cy = my - 292
  const len = Math.sqrt(cx * cx + cy * cy) || 1
  return `M ${x1},${y1} Q ${mx + cx / len * 55},${my + cy / len * 55} ${x2},${y2}`
}

// ─── KnowledgeGraphDemo ───────────────────────────────────────────────────────

function KnowledgeGraphDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hoveredLeaf, setHoveredLeaf] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const active = hoveredLeaf !== null
  const parentCluster = active
    ? CLUSTERS.find(cl => cl.leaves.some(lf => lf.id === hoveredLeaf)) ?? null
    : null

  const T = 'opacity 0.22s ease, stroke-opacity 0.22s ease'

  return (
    <div
      ref={ref}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.94)',
        transition: 'opacity 1.1s ease-out, transform 1.1s ease-out',
      }}
    >
      <svg viewBox="0 0 900 580" style={{ width: '100%', maxWidth: 860, height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>{`
            @keyframes floatNode {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-8px); }
            }
          `}</style>
          {/* Path defs for animateMotion traveling dots */}
          {CLUSTERS.map(cl => (
            <path key={`def-${cl.id}`} id={`path-c-${cl.id}`} d={spokeCurve(450, 292, cl.x, cl.y, 32)} />
          ))}
        </defs>

        {/* Background concentric rings */}
        {[110, 210, 315].map((r, i) => (
          <circle key={r} cx={450} cy={292} r={r} fill="none"
            stroke="#D97706" strokeOpacity={0.045 - i * 0.01} strokeDasharray="3 9" />
        ))}

        {/* Cross-cluster pentagon edges */}
        {CROSS_EDGES.map(({ from, to }) => {
          const a = CLUSTERS.find(c => c.id === from)!
          const b = CLUSTERS.find(c => c.id === to)!
          const dimmed = active && a.id !== parentCluster?.id && b.id !== parentCluster?.id
          return (
            <path key={`cx-${from}-${to}`}
              d={crossCurve(a.x, a.y, b.x, b.y)}
              stroke={dimmed ? 'rgba(180,120,50,0.03)' : 'rgba(180,120,50,0.1)'}
              strokeWidth={1} strokeDasharray="2 7" fill="none"
              style={{ transition: 'stroke 0.22s ease' }}
            />
          )
        })}

        {/* Center → Hub curved paths */}
        {CLUSTERS.map(cl => {
          const isParent = cl.id === parentCluster?.id
          return (
            <path key={`ce-${cl.id}`}
              d={spokeCurve(450, 292, cl.x, cl.y, 32)}
              stroke={cl.color}
              strokeWidth={active && isParent ? 2.5 : 1.5}
              strokeOpacity={active ? (isParent ? 0.88 : 0.04) : 0.22}
              strokeDasharray={active && isParent ? '0' : '5 7'}
              fill="none"
              style={{ transition: T }}
            />
          )
        })}

        {/* Traveling dots along spokes (hidden when a leaf is active) */}
        {CLUSTERS.map(cl => (
          <circle key={`dot-${cl.id}`} r="2.8" fill={cl.color} fillOpacity={active ? 0 : 0.55}
            style={{ transition: 'fill-opacity 0.3s ease' }}>
            <animateMotion dur={`${2.8 + cl.delay * 0.28}s`} repeatCount="indefinite" calcMode="linear">
              <mpath href={`#path-c-${cl.id}`} />
            </animateMotion>
          </circle>
        ))}

        {/* Hub → Leaf curved paths */}
        {CLUSTERS.flatMap(cl =>
          cl.leaves.map(lf => {
            const isActive = lf.id === hoveredLeaf
            return (
              <path key={`le-${lf.id}`}
                d={spokeCurve(cl.x, cl.y, lf.x, lf.y, 14)}
                stroke={cl.color}
                strokeWidth={active && isActive ? 2 : 1}
                strokeOpacity={active ? (isActive ? 0.9 : 0.03) : 0.16}
                strokeDasharray={active && isActive ? '0' : '3 5'}
                fill="none"
                style={{ transition: T }}
              />
            )
          })
        )}

        {/* Center node */}
        <g style={{ animation: 'floatNode 5s ease-in-out infinite', opacity: active ? 0.28 : 1, transition: 'opacity 0.22s ease' }}>
          {/* Outer pulse rings */}
          <circle cx={450} cy={292} r={44} fill="none" stroke="#D97706" strokeWidth={1} strokeOpacity={0}>
            <animate attributeName="r" from="36" to="58" dur="3s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" from="0.3" to="0" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx={450} cy={292} r={44} fill="none" stroke="#D97706" strokeWidth={1} strokeOpacity={0}>
            <animate attributeName="r" from="36" to="58" dur="3s" begin="1.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" from="0.3" to="0" dur="3s" begin="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={450} cy={292} r={36} fill="#D97706" fillOpacity={0.07} stroke="#D97706" strokeWidth={1.5} strokeOpacity={0.35} />
          <circle cx={450} cy={292} r={26} fill="#D97706" fillOpacity={0.16} />
          <circle cx={450} cy={292} r={13} fill="#D97706" fillOpacity={0.32} />
          <text x={450} y={286} textAnchor="middle" fill="#D97706" fontSize={9} fontFamily="'Plus Jakarta Sans',Arial,sans-serif" fontWeight={700} opacity={0.9}>Due Diligence</text>
          <text x={450} y={298} textAnchor="middle" fill="#D97706" fontSize={9} fontFamily="'Plus Jakarta Sans',Arial,sans-serif" fontWeight={700} opacity={0.9}>Report</text>
        </g>

        {/* Clusters */}
        {CLUSTERS.map(cl => {
          const isParent = cl.id === parentCluster?.id
          const hubOpacity = active ? (isParent ? 1 : 0.1) : 1
          return (
            <g key={cl.id} style={{
              animation: `floatNode ${4.2 + cl.delay * 0.15}s ease-in-out infinite`,
              animationDelay: `${cl.delay}s`,
            }}>
              <g style={{ opacity: hubOpacity, transition: 'opacity 0.22s ease' }}>
                {/* Pulse ring */}
                <circle cx={cl.x} cy={cl.y} r={24} fill="none" stroke={cl.color} strokeWidth={1} strokeOpacity={0}>
                  <animate attributeName="r" from="22" to="42" dur={`${3.2 + cl.delay * 0.1}s`} begin={`${cl.delay * 0.25}s`} repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" from="0.35" to="0" dur={`${3.2 + cl.delay * 0.1}s`} begin={`${cl.delay * 0.25}s`} repeatCount="indefinite" />
                </circle>
                {/* Glow ring */}
                <circle cx={cl.x} cy={cl.y} r={28} fill={cl.color} fillOpacity={0.06} />
                {/* Outer hub ring */}
                <circle cx={cl.x} cy={cl.y} r={20} fill={cl.color} fillOpacity={0.16} stroke={cl.color} strokeWidth={1.5} strokeOpacity={0.6} />
                {/* Inner dot */}
                <circle cx={cl.x} cy={cl.y} r={9} fill={cl.color} fillOpacity={0.32} />
                <text x={cl.x} y={cl.y + 36} textAnchor="middle" fill={cl.color} fontSize={10} fontFamily="'Plus Jakarta Sans',Arial,sans-serif" fontWeight={700} opacity={0.88}>
                  {cl.label}
                </text>
              </g>

              {/* Leaves */}
              {cl.leaves.map(lf => {
                const isActive = lf.id === hoveredLeaf
                const leafOpacity = active ? (isActive ? 1 : 0.08) : 1
                return (
                  <g key={lf.id}
                    style={{ opacity: leafOpacity, transition: 'opacity 0.22s ease', cursor: 'default' }}
                    onMouseEnter={() => setHoveredLeaf(lf.id)}
                    onMouseLeave={() => setHoveredLeaf(null)}
                  >
                    <circle cx={lf.x} cy={lf.y} r={20} fill="transparent" />
                    <circle cx={lf.x} cy={lf.y} r={isActive ? 16 : 12} fill={cl.color} fillOpacity={isActive ? 0.2 : 0.1} />
                    <circle cx={lf.x} cy={lf.y} r={isActive ? 10 : 7} fill={cl.color} fillOpacity={isActive ? 0.38 : 0.22} stroke={cl.color} strokeWidth={isActive ? 1.5 : 1} strokeOpacity={isActive ? 0.9 : 0.5} />
                    {isActive && (
                      <circle cx={lf.x} cy={lf.y} r={4} fill={cl.color} fillOpacity={0.7} />
                    )}
                    <text x={lf.x} y={lf.y + 22} textAnchor="middle" fill={cl.color} fontSize={8.5} fontFamily="'Plus Jakarta Sans',Arial,sans-serif" fontWeight={isActive ? 700 : 500} opacity={isActive ? 1 : 0.7}>
                      {lf.label}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main style={{ background: '#FCFAF4', color: '#1C1917', overflowX: 'hidden' }}>
      {/* Nav */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 40px',
        }}
      >
        <span style={{ fontFamily: "'Oliver', serif", fontSize: 26, color: '#1C1917', letterSpacing: '0.02em' }}>
          <span style={{ fontSize: '1.45em', marginRight: '-2px' }}>s</span>yndicate
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="/apply"
            style={{
              fontSize: 13, fontWeight: 600, color: '#92400E',
              textDecoration: 'none', padding: '8px 18px', borderRadius: 9999,
              border: '1.5px solid rgba(180,95,5,0.25)',
              background: 'transparent',
            }}
          >
            Apply
          </a>
          <Link
            href="/dashboard"
            style={{
              fontSize: 13, fontWeight: 600, color: '#92400E',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 9999,
              border: '1.5px solid rgba(180,95,5,0.35)',
              background: 'rgba(252,250,244,0.85)',
              boxShadow: '0 2px 8px rgba(180,95,5,0.14), 0 1px 2px rgba(180,95,5,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
              backdropFilter: 'blur(8px)',
            }}
          >
            Sign in →
          </Link>
        </div>
      </nav>

      {/* ── Section 1: Hero ─────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <ScrambleCanvas />

        {/* Vignette — keeps center clear, gently fades edges on light bg */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, rgba(252,250,244,0.0) 0%, rgba(252,250,244,0.72) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            padding: '0 24px',
            maxWidth: 740,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#D97706',
              marginBottom: 30,
              opacity: 0.75,
            }}
          >
            INVESTMENT DUE DILIGENCE
          </div>

          <h1
            style={{
              fontFamily: "'Oliver', serif",
              fontSize: 'clamp(52px, 7.5vw, 88px)',
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '0.01em',
              margin: '0 0 28px',
              perspective: '600px',
            }}
          >
            <FlipWord />
            <br />
            <span style={{ color: '#1C1917', fontFamily: "'Oliver', serif" }}>on what you invest</span>
          </h1>

          <p
            style={{
              fontSize: 16,
              color: 'rgba(28,25,23,0.52)',
              lineHeight: 1.75,
              maxWidth: 460,
              margin: '0 auto 44px',
            }}
          >
            AI-powered due diligence that turns pitch decks into structured
            intelligence — founders, market, moat, competitors and more.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 30px', background: '#D97706', color: '#fff',
                borderRadius: 10, fontWeight: 700, fontSize: 14,
                textDecoration: 'none', letterSpacing: '-0.01em',
              }}
            >
              Start Analysis
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a
              href="/apply"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '13px 30px',
                background: 'transparent',
                color: '#92400E',
                borderRadius: 10, fontWeight: 700, fontSize: 14,
                textDecoration: 'none', letterSpacing: '-0.01em',
                border: '1.5px solid rgba(180,95,5,0.35)',
              }}
            >
              Apply as Founder
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="scroll-hint"
            style={{
              color: 'rgba(28,25,23,0.32)',
              fontSize: 10,
              letterSpacing: '0.16em',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <span>SCROLL</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 2v10M3 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Section 2: Knowledge Graph ───────────────────────── */}
      <section
        style={{
          position: 'relative',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderTop: '1px solid rgba(217,119,6,0.15)',
        }}
      >
        {/* Subtle dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, rgba(180,95,5,0.18) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 400,
            background:
              'radial-gradient(ellipse, rgba(217,119,6,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            marginBottom: 8,
            padding: '0 24px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: '#D97706',
              marginBottom: 10,
              opacity: 0.75,
            }}
          >
            INTELLIGENCE GRAPH
          </div>
          <h2
            style={{
              fontSize: 'clamp(20px, 2.8vw, 30px)',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: '#1C1917',
              margin: 0,
              opacity: 0.85,
            }}
          >
            Every deal, structured and mapped
          </h2>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: 900,
            flex: 1,
            minHeight: 0,
          }}
        >
          <KnowledgeGraphDemo />
        </div>
      </section>
    </main>
  )
}
