'use client'
import { useEffect, useState } from 'react'

const RING_C = 339.3

export default function LoadingScreen() {
  const [exiting, setExiting] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2100)
    const t2 = setTimeout(() => setGone(true), 2700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (gone) return null

  return (
    <>
      <style>{`
        @keyframes qr { from { stroke-dashoffset: ${RING_C} } to { stroke-dashoffset: 0 } }
        @keyframes qs { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
        @keyframes qn { from { opacity: .15 } to { opacity: 1 } }
        @keyframes qc { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--ground)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: exiting ? 0 : 1,
        transition: exiting ? 'opacity .55s ease' : undefined,
        pointerEvents: exiting ? 'none' : 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <svg width={138} height={138} viewBox="0 0 138 160" fill="none">
            {([
              [80,62,80,36,140],[92.73,67.27,111.11,48.89,280],
              [98,80,124,80,420],[92.73,92.73,111.11,111.11,560],
              [80,98,80,124,700],[67.27,92.73,48.89,111.11,840],
              [62,80,36,80,980],[67.27,67.27,48.89,48.89,1120],
            ] as [number,number,number,number,number][]).map(([x1,y1,x2,y2,delay], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#0F2D6B" strokeWidth={1.5} pathLength={1}
                strokeDasharray={1} strokeDashoffset={1}
                style={{ animation: `qs .3s ease forwards ${delay}ms` }}
              />
            ))}
            <circle cx={80} cy={80} r={54}
              stroke="#0F2D6B" strokeWidth={2} strokeLinecap="round" fill="none"
              strokeDasharray={RING_C} strokeDashoffset={RING_C}
              style={{
                transformBox: 'fill-box', transformOrigin: 'center',
                transform: 'rotate(-90deg)',
                animation: `qr 1.4s cubic-bezier(.16,1,.3,1) forwards 80ms`,
              }}
            />
            {([
              [80,36,140],[111.11,48.89,280],[124,80,420],[111.11,111.11,560],
              [80,124,700],[48.89,111.11,840],[36,80,980],[48.89,48.89,1120],
            ] as [number,number,number][]).map(([cx,cy,delay], i) => (
              <circle key={i} cx={cx} cy={cy} r={5} fill="#0F2D6B"
                style={{ opacity: 0.15, animation: `qn .25s ease forwards ${delay}ms` }}
              />
            ))}
            <circle cx={80} cy={80} r={18} fill="#0F2D6B" />
            <line x1={118.18} y1={118.18} x2={128.08} y2={128.08}
              stroke="#0F2D6B" strokeWidth={2.5} strokeLinecap="round"
              pathLength={1} strokeDasharray={1} strokeDashoffset={1}
              style={{ animation: `qs .3s ease forwards 1050ms` }}
            />
          </svg>
          <span style={{
            font: '700 52px/1 var(--sans)',
            color: 'var(--text)',
            letterSpacing: '-.03em',
            opacity: 0,
            animation: `qc .4s ease forwards 1100ms`,
          }}>CI</span>
        </div>
      </div>
    </>
  )
}
