import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, X, History, Loader2, GitCompare, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useWorkflowHistory } from '@/hooks/useAuditLogs'
import type { AuditLog } from '@/types/audit_log'
import { fmtDateTime } from '@/utils/date'
import WorkflowDiffViewer from './WorkflowDiffViewer'
import WorkflowPreviewModal from './WorkflowPreviewModal'

interface Props {
  workflowId: string
  onClose: () => void
  onRestored?: () => void
}

function actionLabel(action: AuditLog['action']) {
  const map: Record<string, string> = {
    create: 'Oluşturuldu',
    update: 'Güncellendi',
    restore: 'Geri Yüklendi',
    delete: 'Silindi',
    login: 'Giriş',
  }
  return map[action] ?? action
}

function actionColor(action: AuditLog['action']) {
  const map: Record<string, string> = {
    create: 'text-emerald-400',
    update: 'text-blue-400',
    restore: 'text-amber-400',
    delete: 'text-red-400',
  }
  return map[action] ?? 'text-muted-foreground'
}


export default function WorkflowHistoryPanel({ workflowId, onClose, onRestored }: Props) {
  const { data: logs = [], isLoading, refetch } = useWorkflowHistory(workflowId)
  const queryClient = useQueryClient()
  const [diffLog, setDiffLog] = useState<AuditLog | null>(null)
  const [previewLog, setPreviewLog] = useState<AuditLog | null>(null)

  const restore = useMutation({
    mutationFn: async (logId: number) => {
      const res = await api.post(`/workflows/${workflowId}/restore/${logId}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Workflow önceki versiyona geri yüklendi')
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] })
      queryClient.invalidateQueries({ queryKey: ['workflow-history', workflowId] })
      refetch()
      onRestored?.()
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Geri yükleme başarısız')
    },
  })

  return (
    <>
      <div className="flex h-full w-80 flex-col border-l border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Değişiklik Geçmişi</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Log listesi */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Henüz değişiklik kaydı yok</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Workflow kaydedildikçe geçmiş burada görünür
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const canRestore = log.action === 'update' || log.action === 'restore'
                const hasDefinition = log.old_value && typeof log.old_value === 'object' && 'definition' in log.old_value
                const canDiff = hasDefinition && log.new_value && typeof log.new_value === 'object' && 'definition' in log.new_value

                return (
                  <div key={log.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-xs font-medium ${actionColor(log.action)}`}>
                            {actionLabel(log.action)}
                          </span>
                          {log.new_value && typeof log.new_value === 'object' && 'version' in log.new_value && (
                            <span className="text-xs text-muted-foreground/60">
                              v{String(log.new_value.version)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{log.username}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{fmtDateTime(log.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Önizle butonu */}
                        {hasDefinition && (
                          <button
                            onClick={() => setPreviewLog(log)}
                            title="Bu versiyonu önizle"
                            className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Karşılaştır butonu */}
                        {canDiff && (
                          <button
                            onClick={() => setDiffLog(log)}
                            title="Değişiklikleri karşılaştır"
                            className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-400/10 transition-colors"
                          >
                            <GitCompare className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Geri yükle butonu */}
                        {canRestore && hasDefinition && (
                          <button
                            onClick={() => {
                              if (window.confirm('Bu versiyona geri yüklemek istediğinizden emin misiniz? Mevcut değişiklikler kaybolabilir.')) {
                                restore.mutate(log.id)
                              }
                            }}
                            disabled={restore.isPending}
                            title="Bu versiyona geri yükle"
                            className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                          >
                            {restore.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Versiyona ait bilgiler */}
                    {log.old_value && typeof log.old_value === 'object' && 'version' in log.old_value && (
                      <p className="text-xs text-muted-foreground/50 mt-1 truncate">
                        Önceki: v{String(log.old_value.version)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Diff modal */}
      {diffLog && (
        <WorkflowDiffViewer
          log={diffLog}
          onClose={() => setDiffLog(null)}
        />
      )}

      {/* Önizleme modal */}
      {previewLog && (
        <WorkflowPreviewModal
          log={previewLog}
          onClose={() => setPreviewLog(null)}
        />
      )}
    </>
  )
}
