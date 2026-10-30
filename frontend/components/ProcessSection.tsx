'use client'
import { useEffect, useRef } from 'react'

const STEPS = [
  { when: 'Week 1',   title: 'Apply',              desc: 'Share your deck, stage, and raise amount. No warm intro required.' },
  { when: 'Week 2–3', title: 'Screening',           desc: 'A member panel reviews and shortlists. Every founder hears back.' },
  { when: 'Week 4',   title: 'Pitch evening',       desc: 'Present to the group, take live questions, meet the people deciding.' },
  { when: 'Week 5–6', title: 'Diligence and close', desc: 'Members invest together. One term sheet. One clear answer.' },
]

const N     = 4
const NDOTS = 16

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function ease(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2 }
function remap(v: number, a: number, b: number) { return Math.max(0, Math.min(1, (v - a) / (b - a))) }

export default function ProcessSection() {
  const stickyZoneRef = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const headingRef    = useRef<HTMLDivElement>(null)
  const labelRefs     = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const zone   = stickyZoneRef.current!
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    let W = 0, H = 0, navH = 0
    let rawT = 0, smoothT = 0
    let rafId = 0
    let OX = '29,64,48'

    function readOx() {
      const style = getComputedStyle(document.documentElement)
      const v = style.getPropertyValue('--ox-rgb').trim()
      if (v) OX = v
      const blend = style.getPropertyValue('--canvas-blend').trim()
      canvas.style.mixBlendMode = blend || 'multiply'
    }

    function resize() {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
      navH = (document.querySelector('.nav-shell') as HTMLElement)?.offsetHeight ?? 0
      readOx()
    }

    const themeObserver = new MutationObserver(readOx)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    function onScroll() {
      const scrollable = zone.offsetHeight - window.innerHeight
      rawT = Math.max(0, Math.min(1, -zone.getBoundingClientRect().top / scrollable))
    }

    function draw() {
      rafId = requestAnimationFrame(draw)
      smoothT += (rawT - smoothT) * 0.08
      const t = ease(Math.min(smoothT, 1))

      ctx.clearRect(0, 0, W, H)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const cx = W / 2
      const cy = (H + navH) / 2
      const R  = Math.min(W, H) * 0.26
      const Ri = R * 0.82
      const Ro = R * 1.03

      const t1 = remap(t, 0.10, 0.58)
      const t2 = remap(t, 0.52, 1.00)

      const nCircle = Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2
        return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }
      })
      const nLine = Array.from({ length: N }, (_, i) => ({
        x: lerp(W * 0.12, W * 0.88, i / (N - 1)),
        y: cy,
      }))
      const nodes = nCircle.map((nc, i) => ({
        x: lerp(nc.x, nLine[i].x, t2),
        y: lerp(nc.y, nLine[i].y, t2),
      }))

      const dots = Array.from({ length: NDOTS }, (_, idx) => {
        let ex: number, ey: number, nodeIdx: number
        if (idx < 8) {
          const a = (idx / 8) * Math.PI * 2 - Math.PI / 2
          ex = cx + Ri * Math.cos(a)
          ey = cy + Ri * Math.sin(a)
          nodeIdx = Math.floor(idx / 2) % N
        } else {
          const j = idx - 8
          const a = (j / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8
          ex = cx + Ro * Math.cos(a)
          ey = cy + Ro * Math.sin(a)
          nodeIdx = Math.floor(j / 2) % N
        }
        const target = nodes[nodeIdx]
        return { x: lerp(ex, target.x, t1), y: lerp(ey, target.y, t1), nodeIdx }
      })

      const ringA = Math.max(0, 1 - t1 * 1.6)
      if (ringA > 0.005) {
        const Rd = R * 0.58
        const Rw = R * 0.19
        ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${OX}, ${0.07 * ringA})`
        ctx.lineWidth = Rw * 6; ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${OX}, ${0.30 * ringA})`
        ctx.lineWidth = Rw * 2; ctx.stroke()
      }

      const webA = Math.max(0, 1 - t1 * 2.5)
      if (webA > 0.005) {
        ctx.lineWidth = 0.8
        for (let i = 0; i < NDOTS; i++) {
          for (let j = i + 1; j < NDOTS; j++) {
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(${OX}, ${0.09 * webA})`
            ctx.stroke()
          }
        }
      }

      const pathA = remap(t, 0.55, 0.82)
      if (pathA > 0.005) {
        const sp = () => {
          ctx.beginPath()
          ctx.moveTo(nodes[0].x, nodes[0].y)
          for (let i = 1; i < N - 1; i++) {
            const mx = (nodes[i].x + nodes[i + 1].x) / 2
            const my = (nodes[i].y + nodes[i + 1].y) / 2
            ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my)
          }
          ctx.lineTo(nodes[N - 1].x, nodes[N - 1].y)
        }
        sp(); ctx.strokeStyle = `rgba(${OX}, ${0.08 * pathA})`; ctx.lineWidth = 110; ctx.stroke()
        sp(); ctx.strokeStyle = `rgba(${OX}, ${0.16 * pathA})`; ctx.lineWidth = 55;  ctx.stroke()
        sp(); ctx.strokeStyle = `rgba(${OX}, ${0.50 * pathA})`; ctx.lineWidth = 6;   ctx.stroke()
      }

      // Gold RGB for dots and nodes — matches brand accent #FCB303
      const GOLD = '252,179,3'

      const dotA = Math.max(0, 1 - t1 * 1.4)
      if (dotA > 0.005) {
        const now = Date.now() * 0.0006
        dots.forEach((d, i) => {
          const pulse = Math.sin(now + i * 0.75) * 0.06 * (1 - t1)
          const r = 4.5 * (1 + pulse)
          ctx.beginPath(); ctx.arc(d.x, d.y, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${GOLD}, ${0.22 * dotA})`
          ctx.lineWidth = 1.2; ctx.stroke()
          ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${GOLD}, ${0.82 * dotA})`
          ctx.fill()
        })
      }

      const nodeA = remap(t1, 0.65, 1.0)
      if (nodeA > 0.005) {
        const now = Date.now() * 0.0006
        nodes.forEach((p, i) => {
          const pulse = Math.sin(now + i * 1.1) * 0.07
          ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${GOLD}, ${0.30 * nodeA})`
          ctx.lineWidth = 1.5; ctx.stroke()
          ctx.beginPath(); ctx.arc(p.x, p.y, 6 * (1 + pulse), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${GOLD}, ${0.90 * nodeA})`
          ctx.fill()
        })
      }

      if (headingRef.current) {
        headingRef.current.style.opacity = String(Math.max(0, 1 - t * 4))
      }
      const labelA = remap(t, 0.82, 1.0)
      labelRefs.current.forEach((el, i) => {
        if (!el) return
        el.style.opacity = String(labelA)
        el.style.left = `${nodes[i].x}px`
        el.style.top  = `${nodes[i].y + 26}px`
      })
    }

    resize()
    window.addEventListener('resize',  resize,   { passive: true })
    window.addEventListener('scroll',  onScroll, { passive: true })
    draw()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize',  resize)
      window.removeEventListener('scroll',  onScroll)
      themeObserver.disconnect()
    }
  }, [])

  return (
    <section id="process" style={{ background: 'var(--ground)', position: 'relative' }}>
      <div ref={stickyZoneRef} style={{ height: '300vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>

          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, display: 'block' }}
          />

          <div
            ref={headingRef}
            style={{
              position: 'absolute', top: '12%', left: 0, right: 0,
              textAlign: 'center', padding: '0 40px', pointerEvents: 'none',
            }}
          >
            <h2 style={{
              font: '400 clamp(30px,3.8vw,52px)/1.07 var(--serif)',
              letterSpacing: '-.01em', color: 'var(--text)',
            }}>
              What happens after you apply.
            </h2>
          </div>

          {STEPS.map((step, i) => (
            <div
              key={i}
              ref={el => { labelRefs.current[i] = el }}
              style={{
                position: 'absolute',
                transform: 'translateX(-50%)',
                opacity: 0,
                textAlign: 'center',
                width: 170,
                pointerEvents: 'none',
              }}
            >
              <span style={{
                display: 'block',
                font: 'italic 400 15px var(--serif)',
                color: 'var(--ox)',
                marginBottom: 5,
              }}>{step.when}</span>
              <strong style={{
                display: 'block',
                font: '600 14px var(--sans)',
                color: 'var(--text)',
                marginBottom: 4,
              }}>{step.title}</strong>
              <p style={{
                font: '400 12px/1.5 var(--sans)',
                color: 'var(--muted)',
                margin: 0,
              }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
