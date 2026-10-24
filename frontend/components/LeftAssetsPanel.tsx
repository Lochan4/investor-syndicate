'use client'
import { useState, useEffect, useRef } from 'react'
import { api, Asset } from '@/lib/api'

const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv']
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function ext(filename: string) { return filename.split('.').pop()?.toLowerCase() ?? '' }
function fileKind(filename: string): 'audio' | 'video' | 'image' | 'pdf' | 'doc' {
  const e = ext(filename)
  if (AUDIO_EXTS.includes(e)) return 'audio'
  if (VIDEO_EXTS.includes(e)) return 'video'
  if (IMAGE_EXTS.includes(e)) return 'image'
  if (e === 'pdf') return 'pdf'
  return 'doc'
}

function FileIcon({ kind }: { kind: string }) {
  if (kind === 'audio') return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  )
  if (kind === 'video') return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
  if (kind === 'pdf') return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function AssetRow({ asset, projectId, token }: { asset: Asset; projectId: string; token: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const kind = fileKind(asset.filename)

  const handleOpen = async () => {
    let assetUrl = url
    if (!assetUrl) {
      setLoading(true)
      try {
        const data = await api.getAssetDownloadUrl(token, projectId, asset.id)
        assetUrl = data.url
        setUrl(assetUrl)
      } catch {} finally { setLoading(false) }
    }
    window.dispatchEvent(new CustomEvent('open-asset', {
      detail: { id: asset.id, name: asset.filename, url: assetUrl, kind }
    }))
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber/5 transition-colors text-left border-b border-stroke/50 last:border-0 disabled:opacity-60"
    >
      <span className={`${kind === 'audio' ? 'text-purple-500' : kind === 'video' ? 'text-blue-500' : kind === 'pdf' ? 'text-red-500' : 'text-amber'}`}>
        {loading
          ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          : <FileIcon kind={kind} />
        }
      </span>
      <span className="flex-1 text-xs text-ink truncate">{asset.filename}</span>
      <svg className="w-3 h-3 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </button>
  )
}

export function LeftAssetsPanel({ projectId, token, initialCollapsed, onBack }: { projectId: string; token: string; initialCollapsed?: boolean; onBack?: () => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [uploading, setUploading] = useState(false)
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false)
  const fileRef = useRef<HTMLInputElement>(null)
  const tokenRef = useRef(token)

  useEffect(() => {
    fetch('/api/token').then(r => r.ok ? r.json() : null).then(d => { if (d?.token) tokenRef.current = d.token }).catch(() => {})
    api.listAssets(token, projectId).then(setAssets).catch(() => {})
  }, [token, projectId])

  const handleUpload = async (files: FileList | null) => {
    if (!files || uploading) return
    setUploading(true)
    // Refresh token before upload — WorkOS tokens are short-lived
    try {
      const d = await fetch('/api/token').then(r => r.ok ? r.json() : null)
      if (d?.token) tokenRef.current = d.token
    } catch {}
    for (const file of Array.from(files)) {
      try {
        const e = ext(file.name)
        const contentType = CONTENT_TYPES[e] || 'application/octet-stream'
        const kind = fileKind(file.name) === 'audio' ? 'audio'
          : fileKind(file.name) === 'video' ? 'video'
          : fileKind(file.name) === 'pdf' ? 'pdf'
          : 'document'
        const { upload_url, storage_key } = await api.getUploadUrl(tokenRef.current, projectId, file.name, kind, contentType)
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
        const asset = await api.createAsset(tokenRef.current, projectId, { filename: file.name, kind, storage_key })
        await api.confirmAsset(tokenRef.current, projectId, asset.id)
        setAssets(prev => [...prev, asset])
      } catch {}
    }
    setUploading(false)
  }

  if (collapsed) {
    return (
      <div className="flex flex-col h-full bg-surface w-10 items-center transition-all border-r border-stroke">
        {/* Back arrow — top of the left border strip */}
        {onBack && (
          <button
            onClick={onBack}
            title="Back to projects"
            className="mt-3 mb-1 text-muted hover:text-amber transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {/* Expand + label */}
        <button
          onClick={() => setCollapsed(false)}
          className="flex flex-col items-center gap-2 text-muted hover:text-amber transition-colors py-3 mt-2"
          title="Expand assets"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Assets</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface w-64 transition-all">
      {/* Header */}
      <div className="px-3 py-3 border-b border-stroke flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} title="Back to projects" className="text-muted hover:text-amber transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="text-xs font-semibold text-ink uppercase tracking-wide">Assets</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 text-xs text-amber hover:text-amber-700 transition-colors font-medium disabled:opacity-50"
          >
            {uploading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            Upload
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-muted hover:text-amber transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="*/*"
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {/* Upload hint */}
      <div className="px-3 py-2 border-b border-stroke/50 shrink-0">
        <p className="text-xs text-muted leading-relaxed">
          Upload anything — deck, financials, resume, recordings. More context = better analysis.
        </p>
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <svg className="w-8 h-8 text-muted opacity-20" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-xs text-muted">No assets yet</p>
          </div>
        ) : (
          assets.map(asset => (
            <AssetRow key={asset.id} asset={asset} projectId={projectId} token={tokenRef.current} />
          ))
        )}
      </div>
    </div>
  )
}
