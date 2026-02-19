import { useState } from 'react'
import {
  Activity, CheckCircle2, XCircle, Loader2, AlertCircle,
  Search, Filter, RotateCcw, Eye, ChevronDown, ChevronUp, FolderOpen,
} from 'lucide-react'
import { useExecutions, useCancelExecution } from '@/hooks/useExecutions'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useFolderTree } from '@/hooks/useFolders'
import type { FolderTree } from '@/types/folder'
import ExecutionLogViewer from '@/components/executions/ExecutionLogViewer'
import { fmtDateTime, fmtDuration } from '@/utils/date'

const STATUS_BADGE: Record<string, string> = {
  success:   'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700',
  failed:    'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700',
  running:   'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-700',
  pending:   'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600',
  cancelled: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-700',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  success:   <CheckCircle2 className="h-3.5 w-3.5" />,
  failed:    <XCircle className="h-3.5 w-3.5" />,
  running:   <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  pending:   <Loader2 className="h-3.5 w-3.5" />,
  cancelled: <AlertCircle className="h-3.5 w-3.5" />,
}

const STATUS_TR: Record<string, string> = {
  success: 'Başarılı', failed: 'Hatalı', running: 'Çalışıyor',
  pending: 'Bekliyor', cancelled: 'İptal',
}

const TRIGGER_TR: Record<string, string> = {
  manual: 'Manuel', scheduled: 'Zamanlı', chained: 'Zincir',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

/** Klasör ağacını girintili düz listeye çevirir */
function flattenFolderTree(
  folders: FolderTree[],
  depth = 0,
): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = []
  for (const folder of folders) {
    const prefix = depth > 0 ? '\u00a0\u00a0'.repeat(depth) + '└ ' : ''
    result.push({ id: folder.id, label: prefix + folder.name })
    if (folder.children?.length) {
      result.push(...flattenFolderTree(folder.children, depth + 1))
    }
  }
  return result
}

export default function ExecutionsPage() {
  const { data: workflows = [] } = useWorkflows()
  const { data: folderTree = [] } = useFolderTree()
  const cancelExecution = useCancelExecution()

  const [viewingId,  setViewingId]  = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [workflowFilter, setWorkflowFilter] = useState('')
  const [folderFilter,   setFolderFilter]   = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [dateFrom, setDateFrom] = useState(weekAgo())
  const [dateTo,   setDateTo]   = useState(today())

  const { data: executions = [], isLoading, refetch } = useExecutions({
    workflow_id: workflowFilter || undefined,
    folder_id:   folderFilter   || undefined,
    status:      statusFilter   || undefined,
    date_from:   dateFrom       || undefined,
    date_to:     dateTo         || undefined,
    limit: 500,
  })

  const flatFolders = flattenFolderTree(folderTree)

  const totalRows    = executions.reduce((s, e) => s + e.rows_processed, 0)
  const successCount = executions.filter((e) => e.status === 'success').length
  const failedCount  = executions.filter((e) => e.status === 'failed').length
  const runningCount = executions.filter((e) => e.status === 'running' || e.status === 'pending').length

  const hasFilter = !!(workflowFilter || folderFilter || statusFilter)

  return (
    <div className="space-y-5 p-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Çalıştırmalar</h1>
          <p className="text-muted-foreground mt-1">Workflow çalıştırma geçmişi</p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Yenile
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Toplam',   val: executions.length,                color: 'text-foreground' },
          { label: 'Başarılı', val: successCount,                     color: 'text-green-400' },
          { label: 'Hatalı',   val: failedCount,                      color: 'text-red-400' },
          { label: 'Satır',    val: totalRows.toLocaleString('tr-TR'), color: 'text-blue-400' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filtre çubuğu */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card px-4 py-3 items-end">
        <Filter className="h-4 w-4 text-muted-foreground self-center" />

        {/* Tarih aralığı */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Başlangıç:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Bitiş:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>

        {/* Klasör filtresi */}
        <div className="flex items-center gap-1">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={folderFilter}
            onChange={(e) => { setFolderFilter(e.target.value); setWorkflowFilter('') }}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Tüm Klasörler</option>
            {flatFolders.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Workflow filtresi */}
        <div className="flex items-center gap-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={workflowFilter}
            onChange={(e) => { setWorkflowFilter(e.target.value); setFolderFilter('') }}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Tüm Workflow'lar</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Durum filtresi */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_TR).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={() => { setWorkflowFilter(''); setFolderFilter(''); setStatusFilter('') }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Filtreleri temizle
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground self-center">
          {executions.length} kayıt
          {runningCount > 0 && (
            <span className="ml-2 text-blue-400 animate-pulse">● {runningCount} çalışıyor</span>
          )}
        </span>
      </div>

      {/* Tablo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Kayıt bulunamadı</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Seçili tarih aralığında ve filtrelerde çalıştırma kaydı yok.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Durum', 'Workflow / Klasör', 'Başlangıç', 'Bitiş', 'Süre', 'Satır', 'Tetik', 'İşlem'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${i === 7 ? 'text-right' : 'text-left'}`}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <>
                  <tr
                    key={exec.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/10 transition-colors ${
                      exec.status === 'running' ? 'bg-blue-50 dark:bg-blue-950/10' : ''
                    }`}
                  >
                    {/* Durum */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[exec.status] ?? ''}`}>
                        {STATUS_ICON[exec.status]}
                        {STATUS_TR[exec.status] ?? exec.status}
                      </span>
                    </td>

                    {/* Workflow adı + klasör yolu */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm leading-tight">
                        {exec.workflow_name
                          ?? workflows.find((w) => w.id === exec.workflow_id)?.name
                          ?? exec.workflow_id.slice(0, 8)}
                      </p>
                      {exec.folder_path && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          {exec.folder_path}
                        </p>
                      )}
                    </td>

                    {/* Başlangıç */}
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                      {fmtDateTime(exec.started_at)}
                    </td>

                    {/* Bitiş */}
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                      {exec.finished_at
                        ? fmtDateTime(exec.finished_at)
                        : exec.status === 'running'
                          ? <span className="text-blue-400 animate-pulse">Devam ediyor...</span>
                          : '—'
                      }
                    </td>

                    {/* Süre */}
                    <td className="px-4 py-3 text-xs font-mono text-primary">
                      {fmtDuration(exec.started_at, exec.finished_at)}
                    </td>

                    {/* Satır */}
                    <td className="px-4 py-3 text-xs">
                      <span className="text-green-400">{exec.rows_processed.toLocaleString('tr-TR')}</span>
                      {exec.rows_failed > 0 && (
                        <span className="text-red-400 ml-1">/ {exec.rows_failed.toLocaleString('tr-TR')} hata</span>
                      )}
                    </td>

                    {/* Tetikleyici */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {TRIGGER_TR[exec.trigger_type] ?? exec.trigger_type}
                    </td>

                    {/* İşlem butonları */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingId(exec.id)}
                          title="Logları Görüntüle"
                          className="rounded p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {exec.error_message && (
                          <button
                            onClick={() => setExpandedId(expandedId === exec.id ? null : exec.id)}
                            title="Hata detayı"
                            className="rounded p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-500 dark:text-red-400"
                          >
                            {expandedId === exec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                        {(exec.status === 'running' || exec.status === 'pending') && (
                          <button
                            onClick={() => cancelExecution.mutate(exec.id)}
                            title="İptal Et"
                            className="rounded p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-500 dark:text-red-400"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Hata detay satırı */}
                  {expandedId === exec.id && exec.error_message && (
                    <tr key={`${exec.id}-err`} className="bg-red-50 dark:bg-red-950/10">
                      <td colSpan={8} className="px-6 py-3">
                        <p className="text-xs text-red-400 font-mono break-all">{exec.error_message}</p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingId && (
        <ExecutionLogViewer
          executionId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
    </div>
  )
}
