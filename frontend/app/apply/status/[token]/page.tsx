import { api, ApplicationStatus } from '@/lib/api'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; description: string }> = {
  submitted: {
    label: 'Submitted',
    color: '#B45309',
    bg: 'rgba(217,119,6,0.1)',
    description: "We've received your application and it's in our queue for review.",
  },
  reviewing: {
    label: 'Under Review',
    color: '#1D4ED8',
    bg: 'rgba(59,130,246,0.1)',
    description: "Our team is actively reviewing your application. We'll be in touch soon.",
  },
  added: {
    label: 'Accepted',
    color: '#15803D',
    bg: 'rgba(34,197,94,0.1)',
    description: "Congratulations! Your startup has been accepted and added to our pipeline.",
  },
  rejected: {
    label: 'Not Proceeding',
    color: '#B91C1C',
    bg: 'rgba(239,68,68,0.1)',
    description: "After careful review, we've decided not to proceed at this time. Thank you for applying.",
  },
}

const STEPS = ['submitted', 'reviewing', 'added'] as const

export default async function ApplicationStatusPage({ params }: { params: { token: string } }) {
  let app: ApplicationStatus | null = null
  let notFound = false

  try {
    app = await api.getApplicationStatus(params.token)
  } catch {
    notFound = true
  }

  if (notFound || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#FCFAF4' }}>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Application not found</h1>
          <p className="text-slate-500 text-sm">Check your link is correct.</p>
        </div>
      </div>
    )
  }

  const config = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.submitted
  const isRejected = app.status === 'rejected'
  const currentStepIdx = isRejected ? -1 : STEPS.indexOf(app.status as typeof STEPS[number])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: '#FCFAF4' }}>
      {/* Logo */}
      <div className="mb-12">
        <span style={{ fontFamily: "'Oliver', serif", fontSize: 24, color: '#1C1917' }}>
          <span style={{ fontSize: '1.45em', marginRight: '-2px' }}>s</span>yndicate
        </span>
      </div>

      <div className="w-full max-w-md">
        {/* Status badge */}
        <div className="text-center mb-8">
          <span className="inline-block text-sm font-bold px-4 py-2 rounded-full mb-4"
            style={{ background: config.bg, color: config.color }}>
            {config.label}
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">{app.startup_name}</h1>
          <p className="text-sm text-slate-500">Application by {app.founder_name}</p>
        </div>

        {/* Progress tracker (not shown if rejected) */}
        {!isRejected && (
          <div className="card mb-6">
            <div className="flex items-start gap-0">
              {STEPS.map((s, i) => {
                const done = i <= currentStepIdx
                const active = i === currentStepIdx
                const last = i === STEPS.length - 1
                return (
                  <div key={s} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center w-full">
                      <div className="flex-1 h-0.5" style={{ background: i === 0 ? 'transparent' : done ? '#15803D' : 'rgba(141,90,43,0.15)' }} />
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: done ? '#15803D' : 'rgba(141,90,43,0.08)', color: done ? '#fff' : '#8D5A2B' }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div className="flex-1 h-0.5" style={{ background: last ? 'transparent' : done && !active ? '#15803D' : 'rgba(141,90,43,0.15)' }} />
                    </div>
                    <p className="text-xs mt-2 font-medium capitalize text-center"
                      style={{ color: active ? '#D47E30' : done ? '#15803D' : '#8D5A2B', opacity: done ? 1 : 0.6 }}>
                      {s === 'submitted' ? 'Received' : s === 'reviewing' ? 'Reviewing' : 'Accepted'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="card text-center">
          <p className="text-sm text-slate-600">{config.description}</p>
          <p className="text-xs text-slate-400 mt-3">
            Submitted {new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}
