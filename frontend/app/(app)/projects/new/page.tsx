import { withAuth } from '@workos-inc/authkit-nextjs'
import { ProjectForm } from '@/components/ProjectForm'

export default async function NewProjectPage() {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex w-[400px] shrink-0 flex-col justify-between p-10" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" fill="white" opacity="0.9"/>
              <path d="M7 4L9.5 5.5V8.5L7 10L4.5 8.5V5.5L7 4Z" fill="white"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">Syndicate</span>
        </div>

        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-5">How it works</p>
          <div className="space-y-6">
            {[
              { n: '01', title: 'Create a project', body: 'Name the startup and add sector and stage context.' },
              { n: '02', title: 'Upload documents', body: 'PDFs, audio interviews, spreadsheets — the AI reads everything.' },
              { n: '03', title: 'Invite investors', body: 'Each investor explores the knowledge graph independently.' },
              { n: '04', title: 'Reach consensus', body: 'AI synthesises all investor views into a final committee report.' },
            ].map(step => (
              <div key={step.n} className="flex gap-4">
                <span className="text-amber-500 font-bold text-sm shrink-0 w-6 pt-0.5">{step.n}</span>
                <div>
                  <div className="text-slate-100 text-sm font-semibold">{step.title}</div>
                  <div className="text-slate-400 text-xs mt-1 leading-relaxed">{step.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">AI-powered due diligence · Syndicate</p>
      </div>

      {/* Right — centered form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          <ProjectForm token={accessToken!} />
        </div>
      </div>
    </div>
  )
}
