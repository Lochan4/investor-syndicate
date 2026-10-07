'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { api, Asset, EntityGraphData } from '@/lib/api'
import { StatusBadge } from './StatusBadge'
import { Icons } from './Icons'
import { AssetSkeleton } from './Skeleton'
import { useToast } from './Toast'
import { EntityGraph } from './EntityGraph'

const KIND_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/webm': 'audio', 'audio/ogg': 'audio',
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'text/csv': 'spreadsheet', 'application/vnd.ms-excel': 'spreadsheet',
}

function AssetIcon({ kind }: { kind: string }) {
  const cls = 'text-brown-mid'
  if (kind === 'pdf') return <span className={cls}><Icons.File /></span>
  if (kind === 'audio') return <span className={cls}><Icons.Audio /></span>
  if (kind === 'image') return <span className={cls}><Icons.Image /></span>
  if (kind === 'spreadsheet') return <span className={cls}><Icons.Spreadsheet /></span>
  return <span className={cls}><Icons.File /></span>
}

const CAN_DELETE = new Set(['super_admin', 'admin', 'developer'])

export function AssetManager({ projectId, token, platformRole = 'investor' }: { projectId: string; token: string; platformRole?: string }) {
  const canDelete = CAN_DELETE.has(platformRole)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<'files' | 'graph'>('files')
  const [entityGraph, setEntityGraph] = useState<EntityGraphData>({ nodes: [], edges: [] })
  const [graphLoading, setGraphLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadEntityGraph = useCallback(() => {
    setGraphLoading(true)
    api.getEntityGraph(token, projectId)
      .then(data => setEntityGraph(data))
      .catch(() => {})
      .finally(() => setGraphLoading(false))
  }, [projectId, token])

  useEffect(() => {
    let active = true
    const load = () => api.listAssets(token, projectId)
      .then(data => { if (active) { setAssets(data); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    load()
    const id = setInterval(load, 3000)
    return () => { active = false; clearInterval(id) }
  }, [projectId, token])

  const uploadFile = useCallback(async (file: File) => {
    const kind = KIND_MAP[file.type] || 'text'
    setUploading(u => [...u, { name: file.name, progress: 0 }])
    try {
      const { upload_url, storage_key, content_type } = await api.getUploadUrl(token, projectId, file.name, kind, file.type || 'application/octet-stream')
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': content_type } })
      const asset = await api.createAsset(token, projectId, { filename: file.name, kind, storage_key })
      await api.confirmAsset(token, projectId, asset.id)
      toast(`${file.name} uploaded`, 'success')
    } catch (e: any) {
      toast(`Failed to upload ${file.name}: ${e?.message ?? 'unknown error'}`, 'error')
    } finally {
      setUploading(u => u.filter(x => x.name !== file.name))
    }
  }, [token, projectId, toast])

  const deleteAsset = useCallback(async (assetId: string, filename: string) => {
    try {
      await api.deleteAsset(token, projectId, assetId)
      setAssets(a => a.filter(x => x.id !== assetId))
      toast(`${filename} deleted`, 'success')
    } catch (e: any) {
      toast(`Failed to delete: ${e?.message ?? 'unknown error'}`, 'error')
    }
  }, [token, projectId, toast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    Array.from(e.dataTransfer.files).forEach(uploadFile)
  }, [uploadFile])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Assets</h1>
        <div className="flex items-center gap-1 bg-brown-mid/10 rounded-xl p-1">
          <button
            onClick={() => setView('files')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'files' ? 'bg-white text-brown-dark shadow-sm' : 'text-brown-mid hover:text-brown-dark'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => { loadEntityGraph(); setView('graph') }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'graph' ? 'bg-white text-brown-dark shadow-sm' : 'text-brown-mid hover:text-brown-dark'
            }`}
          >
            Knowledge Graph
          </button>
        </div>
      </div>

      {view === 'graph' ? (
        <div style={{ height: '600px' }}>
          {graphLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-amber border-t-transparent rounded-full animate-spin" />
              Loading entity graph…
            </div>
          ) : (
            <EntityGraph data={entityGraph} />
          )}
        </div>
      ) : (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragging ? 'border-amber bg-amber/5' : 'border-brown-mid/30 hover:border-amber/50 hover:bg-amber/[0.02]'
            }`}
          >
            <div className="inline-flex p-3 bg-brown-mid/10 rounded-full mb-3 text-brown-mid">
              <Icons.Upload />
            </div>
            <div className="text-sm font-medium text-brown-dark">Drop files here or click to upload</div>
            <div className="text-xs text-brown-mid mt-1">PDF · Audio · Images · Spreadsheets</div>
            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={e => Array.from(e.target.files || []).forEach(uploadFile)} />
          </div>

          {uploading.map(u => (
            <div key={u.name} className="flex items-center gap-3 px-4 py-3 bg-amber/10 border border-amber/20 rounded-xl mb-2 animate-fade-in">
              <div className="w-4 h-4 border-2 border-amber border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm text-brown-dark flex-1">Uploading <span className="font-medium">{u.name}</span></span>
            </div>
          ))}

          <div className="space-y-2" data-testid="asset-list">
            {loading && [1,2,3].map(i => <AssetSkeleton key={i} />)}

            {!loading && assets.length === 0 && uploading.length === 0 && (
              <div className="text-center py-10 text-brown-mid text-sm">
                No assets yet. Upload your first file above.
              </div>
            )}

            {assets.map(asset => (
              <div key={asset.id} className="card animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brown-mid/10 flex items-center justify-center shrink-0">
                      <AssetIcon kind={asset.kind} />
                    </div>
                    <div>
                      <div className="font-medium text-brown-dark text-sm">{asset.filename}</div>
                      <div className="text-xs text-brown-mid capitalize">{asset.kind}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={asset.status} />
                    {canDelete && (
                      <button
                        onClick={() => deleteAsset(asset.id, asset.filename)}
                        className="p-1.5 rounded-lg text-brown-mid hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Delete asset"
                      >
                        <Icons.Trash />
                      </button>
                    )}
                  </div>
                </div>

                {asset.status === 'failed' && (
                  <div className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    Processing failed. Try re-uploading the file.
                  </div>
                )}

                {asset.status === 'ready' && asset.analysis_cache && (
                  <div className="mt-4 pt-4 border-t border-brown-mid/20 grid grid-cols-3 gap-4 animate-fade-in">
                    <div>
                      <div className="label">Summary</div>
                      <div className="text-xs text-brown-dark leading-relaxed line-clamp-4">
                        {asset.analysis_cache.summary || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="label">Topics</div>
                      <div className="flex flex-wrap gap-1">
                        {(asset.analysis_cache.topics || []).map((t: string) => (
                          <span key={t} className="text-xs bg-amber/15 text-amber px-2 py-0.5 rounded-md">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="label">Key Entities</div>
                      <div className="text-xs text-brown-dark leading-relaxed">
                        {(asset.analysis_cache.entities || []).join(', ') || '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
