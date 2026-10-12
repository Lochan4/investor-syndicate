import { withAuth } from '@workos-inc/authkit-nextjs'
import { api, TemplateCellInput, TemplateVersion } from '@/lib/api'
import { TemplateEditor } from '@/components/flow/TemplateEditor'
import Link from 'next/link'

const USE_CASES = [
  {
    id: 'startup_project_analysis',
    title: 'Startup Project Analysis',
    description: 'Evaluates startups that have been added to the platform as projects. Define the cells and characteristics used during investor due diligence — founder background, market size, competitive landscape, and more.',
  },
  {
    id: 'startup_applicant_analysis',
    title: 'Startup Applicant Analysis',
    description: 'Reviews incoming applications from founders applying to the programme. Set the evaluation criteria used to assess initial fit, founder credentials, and opportunity quality before a project is created.',
  },
]

export default async function FlowTemplatePage({
  searchParams,
}: {
  searchParams: { use_case?: string }
}) {
  const { accessToken } = await withAuth({ ensureSignedIn: true })
  const useCase = searchParams.use_case

  // ── Use-case selector ─────────────────────────────────────
  if (!useCase) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[#825E34] mb-2">Canvas Editor</h1>
        <p className="text-sm text-[#8D5A2B]/60 mb-8">
          Select a use case to view or edit its canvas template.
        </p>
        <div className="flex flex-col gap-4">
          {USE_CASES.map(uc => (
            <Link
              key={uc.id}
              href={`/admin/settings/flow-template?use_case=${uc.id}`}
              className="group flex items-center justify-between bg-white border border-[#C4A882] rounded-2xl px-7 py-6 hover:border-[#D47E30] hover:shadow-md transition-all duration-200"
            >
              <div>
                <h2 style={{ fontFamily: 'Oliver, serif' }} className="text-lg text-[#5C3D1E] mb-1.5 lowercase font-light">
                  {uc.title}
                </h2>
                <p className="text-sm text-[#9A7355] max-w-xl leading-relaxed">
                  {uc.description}
                </p>
              </div>
              <span
                className="ml-8 shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors duration-150"
                style={{ background: '#D47E30' }}
              >
                Edit Canvas →
              </span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── Editor for selected use case ──────────────────────────
  const ucMeta = USE_CASES.find(u => u.id === useCase)
  let versions: TemplateVersion[] = []
  let initialCells: TemplateCellInput[] = []
  try { versions = await api.listTemplateVersions(accessToken!, useCase) } catch {}
  const live = versions.find(v => v.status === 'live')
  if (live) {
    try { initialCells = await api.getTemplateCells(accessToken!, live.id) } catch {}
  }

  return (
    <div data-testid="template-editor">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 pb-2 flex items-center gap-2 text-sm">
        <Link href="/admin/settings/flow-template" className="text-[#8D5A2B]/60 hover:text-[#8D5A2B] transition-colors">
          Canvas Editor
        </Link>
        <span className="text-[#C4A882]">/</span>
        <span className="text-[#825E34] font-medium">{ucMeta?.title ?? useCase}</span>
      </div>
      <TemplateEditor
        token={accessToken!}
        versions={versions}
        initialCells={initialCells}
        useCase={useCase}
      />
    </div>
  )
}
