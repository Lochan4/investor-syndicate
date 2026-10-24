'use client'
import type { CSSProperties } from 'react'

// CSS Motion Path border trail — no framer-motion required.
// The glowing ball travels around the border using `offset-path: rect(...)`.
export function BorderTrail({ size = 80, duration = 3, style }: {
  size?: number
  duration?: number
  style?: CSSProperties
}) {
  return (
    <>
      <style>{`
        @keyframes _bt_move { to { offset-distance: 100%; } }
        .border-trail-ball { animation: _bt_move var(--bt-dur,3s) linear infinite; }
      `}</style>
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        borderRadius: 'inherit', pointerEvents: 'none',
      }}>
        <div
          className="border-trail-ball"
          style={{
            position: 'absolute',
            width: size,
            aspectRatio: '1 / 1',
            offsetPath: 'rect(0 auto auto 0 round 12px)',
            ['--bt-dur' as string]: `${duration}s`,
            ...style,
          } as CSSProperties}
        />
      </div>
    </>
  )
}
