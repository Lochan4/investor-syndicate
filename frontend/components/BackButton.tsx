'use client'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export function BackButton() {
  const router = useRouter()
  const path = usePathname() ?? ''
  const [hovered, setHovered] = useState(false)

  if (/\/projects\/[^/]+\/flow\/[^/]+/.test(path)) return null

  // stroke-dasharray/offset trick: value of 1 = full path length in pathLength units
  const lineStyle = (delay: number): React.CSSProperties => ({
    strokeDasharray: 1,
    strokeDashoffset: hovered ? 0 : 1,
    pathLength: 1,
    transition: `stroke-dashoffset 0.22s cubic-bezier(0.4,0,0.2,1) ${delay}s`,
  } as any)

  return (
    <button
      onClick={() => router.back()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Go back"
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: `1.5px solid ${hovered ? 'rgba(141,90,43,0.35)' : 'rgba(141,90,43,0.15)'}`,
        background: hovered ? 'rgba(252,250,244,0.9)' : 'rgba(252,250,244,0.4)',
        boxShadow: hovered
          ? '0 2px 12px rgba(141,90,43,0.12), 0 1px 3px rgba(141,90,43,0.08)'
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
        backdropFilter: 'blur(6px)',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="#8D5A2B"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Horizontal shaft — draws first */}
        <line
          x1="14" y1="9"
          x2="4"  y2="9"
          vectorEffect="non-scaling-stroke"
          pathLength="1"
          style={lineStyle(0)}
        />
        {/* Top arm of arrow — draws second */}
        <line
          x1="9" y1="4"
          x2="4" y2="9"
          vectorEffect="non-scaling-stroke"
          pathLength="1"
          style={lineStyle(0.08)}
        />
        {/* Bottom arm of arrow — draws third */}
        <line
          x1="4" y1="9"
          x2="9" y2="14"
          vectorEffect="non-scaling-stroke"
          pathLength="1"
          style={lineStyle(0.16)}
        />
      </svg>
    </button>
  )
}
