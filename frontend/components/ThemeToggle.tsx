'use client'
import { useEffect, useState } from 'react'

const THEMES = [
  { id: 'qci-yellow',     label: 'QCI Yellow',     accent: '#0A1628', bg: '#FCB303' },
  { id: 'obsidian-gold',  label: 'Obsidian Gold',  accent: '#B8974E', bg: '#0C0F1A' },
  { id: 'pure-authority', label: 'Pure Authority', accent: '#0D0D0D', bg: '#F7F6F2' },
  { id: 'atlas',          label: 'Atlas',          accent: '#1347C8', bg: '#F5F8FC' },
  { id: 'british-racing', label: 'British Racing', accent: '#0F2D6B', bg: '#F2EDE4' },
  { id: 'coffee-cream',   label: 'Coffee & Cream', accent: '#7B4A2D', bg: '#F5ECD8' },
  { id: 'club-crimson',   label: 'Club Crimson',   accent: '#8B0F24', bg: '#FAF3EC' },
]

export default function ThemeToggle() {
  const [active, setActive] = useState('qci-yellow')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', active)
  }, [active])

  const activeTheme = THEMES.find(t => t.id === active)!

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,0.96)',
      padding: '10px 18px',
      borderRadius: 999,
      boxShadow: '0 4px 24px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12)',
      fontFamily: 'system-ui, sans-serif',
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{
        fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
        color: '#444', marginRight: 4, whiteSpace: 'nowrap', fontWeight: 700,
      }}>
        Theme
      </span>

      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          title={t.label}
          style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`,
            border: active === t.id ? `3px solid #111` : '2px solid #d0d0d0',
            cursor: 'pointer',
            padding: 0,
            outline: active === t.id ? `2px solid ${t.accent}` : 'none',
            outlineOffset: 2,
            transition: 'transform 0.15s, border-color 0.15s, outline 0.15s',
            transform: active === t.id ? 'scale(1.25)' : 'scale(1)',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      ))}

      <span style={{
        fontSize: 11, color: '#333', marginLeft: 4, fontWeight: 600,
        letterSpacing: '.02em', whiteSpace: 'nowrap',
      }}>
        {activeTheme.label}
      </span>
    </div>
  )
}
