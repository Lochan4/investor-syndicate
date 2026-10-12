import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { Project } from '@/lib/api'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="card card-hover block animate-fade-in group">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-ink text-[15px] leading-snug group-hover:text-amber transition-colors duration-150 line-clamp-2 pr-2">
          {project.startup_name}
        </h3>
        <div className="shrink-0"><StatusBadge status={project.status} /></div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {project.sector && (
          <span className="text-xs bg-amber/10 text-amber px-2.5 py-0.5 rounded-md font-medium">{project.sector}</span>
        )}
        {project.stage && (
          <span className="text-xs bg-stroke text-muted px-2.5 py-0.5 rounded-md font-medium">{project.stage}</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-subtle">
          {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="text-xs text-amber font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          Open →
        </span>
      </div>
    </Link>
  )
}
