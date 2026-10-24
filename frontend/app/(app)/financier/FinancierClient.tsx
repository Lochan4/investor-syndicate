'use client'
import { useRouter } from 'next/navigation'
import { FinancierProspect } from '@/lib/api'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function ProgressBar({ given, promised }: { given: number; promised: number }) {
  const pct = promised > 0 ? Math.min(100, (given / promised) * 100) : 0
  return (
    <div style={{ height: 3, borderRadius: 9999, background: 'rgba(254,252,245,0.08)', marginTop: 10 }}>
      <div style={{ height: '100%', borderRadius: 9999, width: `${pct}%`, background: '#D47E30', transition: 'width 0.3s ease' }} />
    </div>
  )
}

export function FinancierClient({ token, initialProspects }: { token: string; initialProspects: FinancierProspect[] }) {
  const router = useRouter()
  const totalPromised = initialProspects.reduce((s, p) => s + p.total_promised, 0)
  const totalGiven    = initialProspects.reduce((s, p) => s + p.total_given,    0)

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a18', padding: '32px 48px 80px' }}>
      {/* Header */}
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(254,252,245,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Financier
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FEFCF5', margin: '0 0 4px' }}>Financial Overview</h1>
        <p style={{ fontSize: 13, color: 'rgba(254,252,245,0.4)', marginBottom: 32 }}>
          {initialProspects.length} prospect{initialProspects.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
          {fmt(totalPromised)} promised &nbsp;·&nbsp; {fmt(totalGiven)} given
        </p>

        {/* Prospects grid */}
        {initialProspects.length === 0 ? (
          <p style={{ color: 'rgba(254,252,245,0.35)', fontSize: 14 }}>No prospects yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {initialProspects.map(p => (
              <button
                key={p.id}
                onClick={() => router.push(`/financier/${p.id}`)}
                style={{
                  textAlign: 'left', padding: '20px 22px',
                  background: 'rgba(254,252,245,0.04)',
                  border: '1px solid rgba(254,252,245,0.08)',
                  borderRadius: 16, cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(212,126,48,0.09)'
                  e.currentTarget.style.borderColor = 'rgba(212,126,48,0.28)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(254,252,245,0.04)'
                  e.currentTarget.style.borderColor = 'rgba(254,252,245,0.08)'
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: '#FEFCF5', marginBottom: 4 }}>
                  {p.startup_name}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  {p.sector && (
                    <span style={{ fontSize: 10, color: 'rgba(254,252,245,0.4)' }}>{p.sector}</span>
                  )}
                  {p.stage && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 9999, background: 'rgba(212,126,48,0.12)', color: '#D47E30', fontWeight: 600 }}>
                      {p.stage}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(254,252,245,0.3)', marginBottom: 2 }}>Promised</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#FEFCF5' }}>{fmt(p.total_promised)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(254,252,245,0.3)', marginBottom: 2 }}>Given</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{fmt(p.total_given)}</div>
                  </div>
                </div>

                {p.total_promised > 0 && <ProgressBar given={p.total_given} promised={p.total_promised} />}

                {p.total_remaining > 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(254,252,245,0.35)', marginTop: 8 }}>
                    {fmt(p.total_remaining)} remaining
                    {p.commitment_count > 0 && ` · ${p.commitment_count} investor${p.commitment_count !== 1 ? 's' : ''}`}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
