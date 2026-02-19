import { X, History, Loader2 } from 'lucide-react'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import type { AuditLogFilter } from '@/types/audit_log'
import { fmtDateTime } from '@/utils/date'

interface Props {
  title: string
  filter: AuditLogFilter
  onClose: () => void
}

const actionLabels: Record<string, string> = {
  create: 'Oluşturuldu',
  update: 'Güncellendi',
  delete: 'Silindi',
  restore: 'Geri Yüklendi',
  login: 'Giriş',
}

const actionColors: Record<string, string> = {
  create:  'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-400/10',
  update:  'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-400/10',
  delete:  'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-400/10',
  restore: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-400/10',
  login:   'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-400/10',
}


export default function AuditLogModal({ title, filter, onClose }: Props) {
  const { data: logs = [], isLoading } = useAuditLogs(filter)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{title} — Geçmiş</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* İçerik */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Kayıt bulunamadı</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-3 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actionColors[log.action] ?? 'text-muted-foreground bg-muted'}`}>
                          {actionLabels[log.action] ?? log.action}
                        </span>
                        {log.entity_name && (
                          <span className="text-xs text-muted-foreground truncate">{log.entity_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{log.username}</span>
                        <span>•</span>
                        <span>{fmtDateTime(log.created_at)}</span>
                        {log.ip_address && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{log.ip_address}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
