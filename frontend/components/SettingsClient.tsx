'use client'
import { useState } from 'react'
import { api, PlatformUser, UserProfile, WorkspaceDetail } from '@/lib/api'

const ROLES = ['investor', 'developer', 'admin', 'super_admin'] as const
const WS_ROLES = ['member', 'owner'] as const

const roleLabel: Record<string, string> = {
  investor: 'Investor',
  developer: 'Developer',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

interface Props {
  token: string
  me: UserProfile
  initialUsers: PlatformUser[]
  initialWorkspaces: WorkspaceDetail[]
}

function WorkspaceSection({ token, workspace, meId }: { token: string; workspace: WorkspaceDetail; meId: string }) {
  const [members, setMembers] = useState(workspace.members)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'owner'>('member')
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const myRole = members.find(m => m.user_id === meId)?.role
  const canManage = myRole === 'owner'

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    setSuccess('')
    try {
      await api.inviteToWorkspace(token, workspace.id, inviteEmail.trim(), inviteRole)
      setSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      // Refresh members
      const updated = await api.getWorkspace(token, workspace.id)
      setMembers(updated.members)
    } catch (e: any) {
      setError(e?.message ?? 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (userId: string) => {
    setRemoving(userId)
    try {
      await api.removeWorkspaceMember(token, workspace.id, userId)
      setMembers(m => m.filter(x => x.user_id !== userId))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#825E34]">{workspace.name}</h2>
          {workspace.description && <p className="text-xs text-[#8D5A2B]/60 mt-0.5">{workspace.description}</p>}
        </div>
        <span className="text-xs text-[#8D5A2B]/50">{members.length} member{members.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white/60 border border-[#8D5A2B]/30 rounded-xl overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#8D5A2B]/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Role</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id} className="border-b border-[#8D5A2B]/10 last:border-0">
                <td className="px-4 py-3 text-[#825E34]">
                  {m.email}
                  {m.user_id === meId && <span className="ml-2 text-xs text-[#8D5A2B]/50">(you)</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    m.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {m.role}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    {m.user_id !== meId && (
                      <button
                        onClick={() => removeMember(m.user_id)}
                        disabled={removing === m.user_id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      >
                        {removing === m.user_id ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="flex gap-2 items-center">
          <input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            className="flex-1 px-3 py-2 text-sm border border-[#8D5A2B]/30 rounded-lg bg-white/80 text-[#825E34] placeholder-[#8D5A2B]/40 focus:outline-none focus:border-[#D47E30]"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as 'member' | 'owner')}
            className="px-3 py-2 text-sm border border-[#8D5A2B]/30 rounded-lg bg-white/80 text-[#825E34] focus:outline-none focus:border-[#D47E30]"
          >
            {WS_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2 bg-[#D47E30] text-white rounded-lg text-sm font-semibold hover:bg-[#B86A20] disabled:opacity-50 transition-colors"
          >
            {inviting ? 'Sending…' : 'Invite'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-600 mt-2">{success}</p>}
    </div>
  )
}

export function SettingsClient({ token, me, initialUsers, initialWorkspaces }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'workspace' | 'platform'>('workspace')

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdating(userId)
    setError('')
    try {
      await api.updateUserRole(token, userId, role)
      setUsers(u => u.map(user => user.id === userId ? { ...user, platform_role: role } : user))
    } catch (e: any) {
      setError(e.message || 'Failed to update role')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="page-title mb-6">Admin Control</h1>

      <div className="flex gap-1 mb-6 bg-[#8D5A2B]/08 rounded-xl p-1 w-fit border border-[#8D5A2B]/15">
        {(['workspace', 'platform'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-[#D47E30] text-white shadow-sm'
                : 'text-[#8D5A2B] hover:bg-[#8D5A2B]/10'
            }`}
          >
            {t === 'workspace' ? 'Workspace Members' : 'Platform Users'}
          </button>
        ))}
      </div>

      {tab === 'workspace' && (
        <div>
          {initialWorkspaces.length === 0 ? (
            <p className="text-sm text-[#8D5A2B]/60">No workspaces found.</p>
          ) : (
            initialWorkspaces.map(ws => (
              <WorkspaceSection key={ws.id} token={token} workspace={ws} meId={me.id} />
            ))
          )}
        </div>
      )}

      {tab === 'platform' && (
        <>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <div className="bg-white/60 border border-[#8D5A2B]/30 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#8D5A2B]/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8D5A2B] uppercase tracking-wide">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-[#8D5A2B]/10 last:border-0">
                    <td className="px-4 py-3 text-[#825E34]">
                      {u.email}
                      {u.id === me.id && <span className="ml-2 text-xs text-[#8D5A2B]/50">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id === me.id ? (
                        <span className="text-xs text-[#825E34] font-medium">{roleLabel[u.platform_role] ?? u.platform_role}</span>
                      ) : (
                        <select
                          value={u.platform_role}
                          disabled={updating === u.id}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="text-xs border border-[#8D5A2B]/40 rounded px-2 py-1 bg-white/80 text-[#825E34] focus:outline-none focus:border-[#D47E30] disabled:opacity-50"
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{roleLabel[r]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
