export interface Project { id: string; startup_name: string; sector?: string; stage?: string; status: string; is_investable?: boolean | null; decision_notes?: string | null; decided_at?: string | null; created_at: string }
export interface GraphData {
  nodes: Array<{ id: string; asset_id: string; asset_name: string; kind: string; preview: string }>
  edges: Array<{ source: string; target: string }>
}
export interface EntityGraphData {
  nodes: Array<{ id: string; name: string; kind: string; node_type?: string }>
  edges: Array<{ source: string; target: string; weight?: number }>
}
export interface Investment extends Project { role: string }
export interface Asset { id: string; filename: string; kind: string; status: string; analysis_cache?: { entities: string[]; summary: string; topics: string[] }; created_at: string }
export interface FlowCell { id: string; topic: string; prompt?: string; description?: string; position_x: number; position_y: number; output_cache?: any }
export interface FlowEdge { id: string; from_cell: string; to_cell: string }
export interface Analysis { id: string; stage: string; content: any; created_at: string }
export interface Notification { id: string; project_id: string; kind: string; created_at: string }
export interface TemplateVersion { id: string; version_num: number; status: string; use_case: string; published_at?: string; published_by_email?: string }
export interface Characteristic { name: string; strength: number }
export interface TemplateCellInput { id?: string; topic: string; prompt: string; description?: string; position_x: number; position_y: number; cell_order: number; characteristics: Characteristic[]; policy_doc_ids: string[] }
export interface UserProfile { id: string; email: string; platform_role: string; can_edit_canvas: boolean }
export interface PlatformUser { id: string; email: string; platform_role: string; status: string; created_at: string }
export interface PolicyDoc { id: string; filename: string; storage_key: string; created_at: string }
export type ActivityEventType =
  | 'intent'
  | 'search_start' | 'search_done'
  | 'browser_start' | 'screenshot'
  | 'kg_start' | 'kg_done'
  | 'sources_done' | 'route' | 'traversal'
  | 'dock_window'
  | 'error'
export interface ActivityEvent { type: ActivityEventType; data: Record<string, any> }
export interface Workspace { id: string; name: string; description?: string; created_by?: string; created_at: string; member_count?: number }
export interface WorkspaceMember { user_id: string; email: string; role: string; added_at: string }
export interface WorkspaceDetail extends Workspace { members: WorkspaceMember[] }
export interface Application {
  id: string; founder_name: string; founder_email: string; startup_name: string
  sector?: string; stage?: string; one_liner?: string; website?: string
  pitch_doc_key?: string; pitch_doc_name?: string
  status: 'submitted' | 'reviewing' | 'added' | 'rejected'
  status_token: string; workspace_id?: string; project_id?: string
  reviewed_by?: string; reviewed_at?: string; created_at: string
}
export interface ApplicationStatus { id: string; startup_name: string; founder_name: string; status: string; created_at: string }
export type KgEventType = 'kg_snapshot' | 'kg_nodes' | 'kg_edges' | 'kg_done'
export interface KgEvent { type: KgEventType; data: Record<string, any> }

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

async function publicFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getFreshToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/token')
    if (!res.ok) return null
    return (await res.json()).token
  } catch { return null }
}

async function apiFetch<T>(path: string, token: string, opts: RequestInit = {}): Promise<T> {
  const makeReq = (t: string) => fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...opts.headers },
  })
  let res = await makeReq(token)
  // Silent token refresh on 401 (client-side only — server components always get fresh tokens)
  if (res.status === 401 && typeof window !== 'undefined') {
    const fresh = await getFreshToken()
    if (fresh) res = await makeReq(fresh)
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  // Projects
  listProjects: (token: string) => apiFetch<Project[]>('/projects', token),
  getProject: (token: string, id: string) => apiFetch<Project>(`/projects/${id}`, token),
  createProject: (token: string, body: { startup_name: string; sector?: string; stage?: string }) =>
    apiFetch<Project>('/projects', token, { method: 'POST', body: JSON.stringify(body) }),
  listInvestments: (token: string) => apiFetch<Investment[]>('/investments', token),
  deleteProject: (token: string, id: string) =>
    apiFetch(`/projects/${id}`, token, { method: 'DELETE' }),
  setProjectDecision: (token: string, id: string, is_investable: boolean, notes?: string) =>
    apiFetch(`/projects/${id}/decision`, token, { method: 'PATCH', body: JSON.stringify({ is_investable, notes }) }),

  // Assets
  listAssets: (token: string, projectId: string) => apiFetch<Asset[]>(`/projects/${projectId}/assets`, token),
  createAsset: (token: string, projectId: string, body: { filename: string; kind: string; storage_key: string }) =>
    apiFetch<Asset>(`/projects/${projectId}/assets`, token, { method: 'POST', body: JSON.stringify(body) }),
  confirmAsset: (token: string, projectId: string, assetId: string) =>
    apiFetch(`/projects/${projectId}/assets/${assetId}/confirm`, token, { method: 'POST' }),
  deleteAsset: (token: string, projectId: string, assetId: string) =>
    apiFetch(`/projects/${projectId}/assets/${assetId}`, token, { method: 'DELETE' }),
  reanalyseAsset: (token: string, projectId: string, assetId: string) =>
    apiFetch(`/projects/${projectId}/assets/${assetId}/reanalyse`, token, { method: 'POST' }),
  getUploadUrl: (token: string, projectId: string, filename: string, kind: string, content_type: string) =>
    apiFetch<{ upload_url: string; storage_key: string; content_type: string }>(`/projects/${projectId}/assets/upload-url`, token, {
      method: 'POST', body: JSON.stringify({ filename, kind, content_type }),
    }),
  getAssetDownloadUrl: (token: string, projectId: string, assetId: string) =>
    apiFetch<{ url: string }>(`/projects/${projectId}/assets/${assetId}/download-url`, token),

  // Conversation
  getOrCreateSession: (token: string, projectId: string, cellId: string) =>
    apiFetch<{ session_id: string; status: string }>(`/projects/${projectId}/sessions/${cellId}`, token, { method: 'POST' }),
  sendMessage: (token: string, projectId: string, sessionId: string, message: string, cellId: string) =>
    apiFetch<{ answer: string; sources: string[] }>(`/projects/${projectId}/conversation/${sessionId}/message`, token, {
      method: 'POST', body: JSON.stringify({ message, cell_id: cellId }),
    }),
  submitSession: (token: string, projectId: string, sessionId: string) =>
    apiFetch(`/projects/${projectId}/conversation/${sessionId}/submit`, token, { method: 'POST' }),
  setConfidenceScore: (token: string, projectId: string, sessionId: string, cellId: string, score: number) =>
    apiFetch(`/projects/${projectId}/conversation/${sessionId}/confidence`, token, {
      method: 'PATCH', body: JSON.stringify({ cell_id: cellId, score }),
    }),
  getCellHistory: (token: string, projectId: string, cellId: string) =>
    apiFetch<{ role: string; content: string }[]>(`/projects/${projectId}/conversation/${cellId}/turns`, token),
  sendVoice: async (token: string, projectId: string, sessionId: string, blob: Blob): Promise<string> => {
    const form = new FormData()
    form.append('audio', blob, 'voice.webm')
    const res = await fetch(`${BASE}/projects/${projectId}/conversation/${sessionId}/voice`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    })
    if (!res.ok) throw new Error(`Voice API ${res.status}`)
    return (await res.json()).transcript as string
  },

  // Flow
  getFlowCells: (token: string, projectId: string) =>
    apiFetch<{ cells: FlowCell[]; edges: FlowEdge[] }>(`/projects/${projectId}/flow/cells`, token),
  openProject: (token: string, projectId: string) =>
    apiFetch(`/projects/${projectId}/flow/open`, token, { method: 'POST' }),

  // Analyses
  listAnalyses: (token: string, projectId: string) =>
    apiFetch<Analysis[]>(`/projects/${projectId}/analyses`, token),
  triggerCellAnalysis: (token: string, projectId: string, cellId: string) =>
    apiFetch(`/projects/${projectId}/analyses/cells/${cellId}/analyse`, token, { method: 'POST' }),

  // Notifications
  listNotifications: (token: string) => apiFetch<Notification[]>('/notifications', token),
  markRead: (token: string, notificationId: string) =>
    apiFetch(`/notifications/${notificationId}/read`, token, { method: 'POST' }),

  // Graph
  getProjectGraph: (token: string, projectId: string) =>
    apiFetch<GraphData>(`/projects/${projectId}/assets/graph`, token),
  getEntityGraph: (token: string, projectId: string) =>
    apiFetch<EntityGraphData>(`/projects/${projectId}/assets/entity-graph`, token),

  // Competitive scan
  triggerCompetitiveScan: (token: string, projectId: string) =>
    apiFetch<{ queued: boolean }>(`/projects/${projectId}/competitive-scan`, token, { method: 'POST' }),

  // Admin flow template
  listTemplateVersions: (token: string, useCase?: string) =>
    apiFetch<TemplateVersion[]>(`/admin/flow-template/versions${useCase ? `?use_case=${useCase}` : ''}`, token),
  getTemplateCells: (token: string, versionId: string) =>
    apiFetch<TemplateCellInput[]>(`/admin/flow-template/cells/${versionId}`, token),
  updateCellPolicyDocs: (token: string, cellId: string, policy_doc_ids: string[]) =>
    apiFetch(`/admin/flow-template/cells/${cellId}/policy-docs`, token, {
      method: 'PATCH', body: JSON.stringify({ policy_doc_ids }),
    }),
  publishTemplate: (token: string, cells: TemplateCellInput[], useCase: string) =>
    apiFetch('/admin/flow-template/publish', token, { method: 'POST', body: JSON.stringify({ cells, use_case: useCase }) }),
  promoteVersion: (token: string, versionId: string) =>
    apiFetch(`/admin/flow-template/versions/${versionId}/promote`, token, { method: 'POST' }),
  extractCharacteristics: (token: string, prompt: string, policy_doc_ids: string[] = []) =>
    apiFetch<{ topic: string; characteristics: Characteristic[] }>('/admin/flow-template/extract-characteristics', token, {
      method: 'POST', body: JSON.stringify({ prompt, policy_doc_ids }),
    }),

  // Canvas policy docs
  listPolicyDocs: (token: string) => apiFetch<PolicyDoc[]>('/admin/canvas-policy-docs', token),
  getPolicyDocUploadUrl: (token: string, filename: string) =>
    apiFetch<{ upload_url: string; storage_key: string; content_type: string }>('/admin/canvas-policy-docs/upload-url', token, {
      method: 'POST', body: JSON.stringify({ filename }),
    }),
  confirmPolicyDoc: (token: string, filename: string, storage_key: string) =>
    apiFetch<PolicyDoc>('/admin/canvas-policy-docs/confirm', token, {
      method: 'POST', body: JSON.stringify({ filename, storage_key }),
    }),

  // Invites
  inviteUser: (token: string, email: string, project_id: string, role: string) =>
    apiFetch('/admin/invite', token, { method: 'POST', body: JSON.stringify({ email, project_id, role }) }),
  inviteToWorkspace: (token: string, workspaceId: string, email: string, role: string) =>
    apiFetch(`/workspaces/${workspaceId}/invite`, token, { method: 'POST', body: JSON.stringify({ email, role }) }),

  // Workspace
  listWorkspaces: (token: string) => apiFetch<Workspace[]>('/workspaces', token),
  getWorkspace: (token: string, workspaceId: string) => apiFetch<WorkspaceDetail>(`/workspaces/${workspaceId}`, token),
  removeWorkspaceMember: (token: string, workspaceId: string, userId: string) =>
    apiFetch(`/workspaces/${workspaceId}/members/${userId}`, token, { method: 'DELETE' }),

  // Project members
  listProjectMembers: (token: string, projectId: string) =>
    apiFetch<Array<{ user_id: string; email: string; role: string }>>(`/projects/${projectId}/members`, token),
  getMyProjectRole: (token: string, projectId: string) =>
    apiFetch<{ role: string }>(`/projects/${projectId}/my-role`, token),

  // Apply (public — no auth)
  submitApplication: (body: {
    founder_name: string; founder_email: string; startup_name: string
    sector?: string; stage?: string; one_liner?: string; website?: string
    pitch_doc_key?: string; pitch_doc_name?: string
  }) => publicFetch<{ id: string; status_token: string; startup_name: string }>('/apply', { method: 'POST', body: JSON.stringify(body) }),
  getApplyUploadUrl: (filename: string, content_type: string) =>
    publicFetch<{ upload_url: string; storage_key: string }>('/apply/upload-url', { method: 'POST', body: JSON.stringify({ filename, content_type }) }),
  getApplicationStatus: (token: string) => publicFetch<ApplicationStatus>(`/apply/status/${token}`),

  // Applications (admin)
  listApplications: (token: string) => apiFetch<Application[]>('/applications', token),
  getApplication: (token: string, id: string) => apiFetch<Application>(`/applications/${id}`, token),
  updateApplicationStatus: (token: string, id: string, status: string) =>
    apiFetch(`/applications/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }),
  addApplicationToWorkspace: (token: string, appId: string, workspaceId: string) =>
    apiFetch<{ project_id: string; workspace_id: string }>(`/applications/${appId}/add-to-workspace`, token, {
      method: 'POST', body: JSON.stringify({ workspace_id: workspaceId }),
    }),

  // Workspaces
  listWorkspaces: (token: string) => apiFetch<Workspace[]>('/workspaces', token),
  createWorkspace: (token: string, body: { name: string; description?: string }) =>
    apiFetch<Workspace>('/workspaces', token, { method: 'POST', body: JSON.stringify(body) }),
  getWorkspace: (token: string, id: string) => apiFetch<WorkspaceDetail>(`/workspaces/${id}`, token),
  listWorkspaceProjects: (token: string, id: string) => apiFetch<Project[]>(`/workspaces/${id}/projects`, token),
  createWorkspaceProject: (token: string, workspaceId: string, body: { startup_name: string; sector?: string; stage?: string }) =>
    apiFetch<Project>(`/workspaces/${workspaceId}/projects`, token, { method: 'POST', body: JSON.stringify(body) }),
  addWorkspaceMember: (token: string, workspaceId: string, email: string, role = 'member') =>
    apiFetch(`/workspaces/${workspaceId}/members`, token, { method: 'POST', body: JSON.stringify({ email, role }) }),
  removeWorkspaceMember: (token: string, workspaceId: string, userId: string) =>
    apiFetch(`/workspaces/${workspaceId}/members/${userId}`, token, { method: 'DELETE' }),

  // Investor waterfall
  getProjectActivities: (token: string, projectId: string) =>
    apiFetch<Activity[]>(`/projects/${projectId}/activities`, token),
  investorStage1: (token: string, message: string) =>
    apiFetch<Stage1Response>('/investor/stage1', token, { method: 'POST', body: JSON.stringify({ message }) }),
  adminStage1: (token: string, message: string) =>
    apiFetch<AdminStage1Response>('/admin/stage1', token, { method: 'POST', body: JSON.stringify({ message }) }),
  transcribeAudio: async (token: string, blob: Blob): Promise<string> => {
    const form = new FormData()
    form.append('audio', blob, 'voice.webm')
    const res = await fetch(`${BASE}/investor/transcribe`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    })
    if (!res.ok) throw new Error(`Transcribe ${res.status}`)
    return (await res.json()).transcript as string
  },

  // User / admin control
  getMe: (token: string) => apiFetch<UserProfile>('/me', token),
  listUsers: (token: string) => apiFetch<PlatformUser[]>('/admin/users', token),
  updateUserRole: (token: string, userId: string, platform_role: string) =>
    apiFetch('/admin/users/' + userId + '/role', token, { method: 'PATCH', body: JSON.stringify({ platform_role }) }),
}

export function streamActivityFeed(
  projectId: string,
  cellId: string,
  token: string,
  onEvent: (e: ActivityEvent) => void,
): () => void {
  const url = `${BASE}/projects/${projectId}/conversation/${cellId}/activity`
  const ctrl = new AbortController()
  fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    .then(async (res) => {
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = dec.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try { onEvent(JSON.parse(line.slice(6))) } catch {}
        }
      }
    })
    .catch(() => {})
  return () => ctrl.abort()
}

export function streamKgFeed(
  projectId: string,
  token: string,
  onEvent: (e: KgEvent) => void,
): () => void {
  const url = `${BASE}/projects/${projectId}/assets/graph/stream`
  const ctrl = new AbortController()
  fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    .then(async (res) => {
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = dec.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try { onEvent(JSON.parse(line.slice(6))) } catch {}
        }
      }
    })
    .catch(() => {})
  return () => ctrl.abort()
}

export interface Activity {
  id: string
  topic: string
  description?: string
  turn_count: number
  confidence_score?: number
  completion_pct: number
  state: 'open' | 'in_progress' | 'closed'
}

export interface Stage1Project {
  id: string; startup_name: string; sector?: string; stage?: string; status: string; role?: string
}
export interface Stage1Workspace {
  id: string; name: string; description?: string; role?: string
}
export interface Stage1Response {
  intent: string; message: string; projects: Stage1Project[]; workspaces: Stage1Workspace[]
}
export interface AdminStage1Response {
  intent: string; message: string
  applications: Array<{ id: string; founder_name: string; startup_name: string; sector?: string; stage?: string; status: string }>
  workspaces: Array<{ id: string; name: string; description?: string }>
  projects: Array<{ id: string; startup_name: string; sector?: string; status: string }>
}

export interface CitationSource { id: string; name: string; url?: string; chunk_preview?: string }

export function streamAnswer(
  projectId: string,
  sessionId: string,
  message: string,
  cellId: string,
  token: string,
  onToken: (t: string) => void,
  onDone: (sources: CitationSource[]) => void,
  onTraversal?: (data: { seeds: Array<{id: string; asset_id: string; relevance: number; preview: string}>; total_nodes: number; source_ids: string[] }) => void,
  onError?: (msg: string) => void,
) {
  const url = `${BASE}/projects/${projectId}/conversation/${sessionId}/stream?message=${encodeURIComponent(message)}&cell_id=${encodeURIComponent(cellId)}`
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async (res) => {
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = dec.decode(value).split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'traversal') onTraversal?.(data)
          if (data.type === 'token') onToken(data.token)
          if (data.type === 'done') onDone(data.sources || [])
          if (data.type === 'error') { onError?.(data.message); onDone([]) }
          if (data.type === 'guardrail') { onError?.(data.message); onDone([]) }
        } catch {}
      }
    }
  }).catch(e => { onError?.(e?.message ?? 'Stream failed'); onDone([]) })
}
