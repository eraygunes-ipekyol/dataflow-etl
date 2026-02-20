import type { ReactElement } from 'react'
import { useState } from 'react'
import {
  Activity, Database, GitBranch, Clock,
  CheckCircle2, XCircle, Loader2, AlertCircle,
  Eye, ChevronDown, ChevronUp, FolderOpen,
} from 'lucide-react'
import { useConnections } from '@/hooks/useConnections'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useExecutions, useCancelExecution } from '@/hooks/useExecutions'
import { useSchedules } from '@/hooks/useSchedules'
import ExecutionLogViewer from '@/components/executions/ExecutionLogViewer'
import { fmtDateTime, fmtDuration } from '@/utils/date'

const STATUS_BADGE: Record<string, string> = {
  success:   'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700',
  failed:    'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700',
  running:   'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-700',
  pending:   'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600',
  cancelled: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-700',
}

const STATUS_ICON: Record<string, ReactElement> = {
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

export default function DashboardPage() {
  const { data: connections = [] } = useConnections()
  const { data: workflows = [] } = useWorkflows()
  const { data: executions = [] } = useExecutions({ limit: 10 })
  const { data: schedules = [] } = useSchedules()
  const cancelExecution = useCancelExecution()

  const [viewingId,  setViewingId]  = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const stats = [
    { label: 'Bağlantılar',   value: connections.length,                         icon: Database,  color: 'text-blue-400' },
    { label: 'Workflowlar',   value: workflows.length,                            icon: GitBranch, color: 'text-green-400' },
    { label: 'Çalıştırmalar', value: executions.length,                           icon: Activity,  color: 'text-yellow-400' },
    { label: 'Zamanlamalar',  value: schedules.filter((s) => s.is_active).length, icon: Clock,     color: 'text-purple-400' },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">EROS - ETL genel bakış</p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Son çalıştırmalar */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Son Çalıştırmalar</h2>
          <span className="text-xs text-muted-foreground">Son 10 kayıt</span>
        </div>

        {executions.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            Henüz çalıştırma yok. Bir workflow oluşturup çalıştırarak başlayın.
          </div>
        ) : (
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
                        {STATUS_ICON[exec.status] ?? null}
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
        )}
      </div>

      {/* Log viewer modal */}
      {viewingId && (
        <ExecutionLogViewer
          executionId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
    </div>
  )
}
