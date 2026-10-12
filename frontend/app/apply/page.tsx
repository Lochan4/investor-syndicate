import { ApplySection } from '@/components/ApplySection'

export default function ApplyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FCFAF4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0 60px' }}>
      {/* Logo */}
      <div style={{ marginBottom: 48 }}>
        <span style={{ fontFamily: "'Oliver', serif", fontSize: 24, color: '#1C1917', letterSpacing: '0.02em' }}>
          <span style={{ fontSize: '1.45em', marginRight: '-2px' }}>s</span>yndicate
        </span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#D97706', opacity: 0.75, marginBottom: 8 }}>
        APPLY
      </div>
      <h1 style={{ fontFamily: "'Oliver', serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, color: '#1C1917', textAlign: 'center', margin: '0 0 40px', padding: '0 24px' }}>
        submit your startup
      </h1>
      <ApplySection />
    </div>
  )
}
