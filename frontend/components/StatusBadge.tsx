const CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; pulse?: boolean }> = {
  draft:          { label: 'Draft',        dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600' },
  building_graph: { label: 'Processing',   dot: 'bg-amber',       bg: 'bg-amber/10',    text: 'text-amber', pulse: true },
  open:           { label: 'Open',         dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  consensus:      { label: 'In Consensus', dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700' },
  final:          { label: 'Final',        dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700' },
  pending:        { label: 'Pending',      dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600' },
  processing:     { label: 'Processing',   dot: 'bg-amber',       bg: 'bg-amber/10',    text: 'text-amber', pulse: true },
  embedding:      { label: 'Embedding',    dot: 'bg-amber',       bg: 'bg-amber/10',    text: 'text-amber', pulse: true },
  ready:          { label: 'Ready',        dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  failed:         { label: 'Failed',       dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-600' },
  submitted:      { label: 'Submitted',    dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  active:         { label: 'Active',       dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
}

export function StatusBadge({ status }: { status: string }) {
  const c = CONFIG[status] ?? { label: status, dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' }
  return (
    <span data-testid="status-badge" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}
