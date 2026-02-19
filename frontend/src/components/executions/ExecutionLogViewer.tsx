import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react'
import type { ExecutionLog } from '@/types/execution'
import { useExecution } from '@/hooks/useExecutions'
import { fmtTime, fmtDuration, fmtDateTime } from '@/utils/date'

interface NodeInfo {
  id: string
  label?: string
}

interface Props {
  executionId: string
  onClose: () => void
  nodes?: NodeInfo[]
}

// Log terminal her zaman dark arka plana sahip (bg-zinc-950), bu yüzden renkler sabit
const LEVEL_STYLES: Record<string, string> = {
  info: 'text-zinc-200',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-zinc-500',
}

const STATUS_ICON = {
  pending: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-400" />,
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  cancelled: <AlertCircle className="h-4 w-4 text-yellow-500" />,
}

export default function ExecutionLogViewer({ executionId, onClose, nodes }: Props) {
  const { data: execution } = useExecution(executionId)

  // node_id → label haritası
  const nodeLabelMap: Record<string, string> = {}
  if (nodes) {
    for (const n of nodes) {
      nodeLabelMap[n.id] = n.label || n.id.slice(0, 8)
    }
  }
  const [wsLogs, setWsLogs] = useState<ExecutionLog[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // WebSocket bağlantısı ile canlı log al
  useEffect(() => {
    if (!executionId || executionId === 'pending') return

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${wsProto}://${window.location.host}/ws/api/v1/executions/ws/${executionId}/logs`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'done') return
      if (data.message) {
        setWsLogs((prev) => [...prev, data as ExecutionLog])
      }
    }

    return () => ws.close()
  }, [executionId])

  // Yeni log gelince aşağı kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [wsLogs, execution?.logs])

  const logs = wsLogs.length > 0 ? wsLogs : (execution?.logs ?? [])
  const status = execution?.status ?? 'pending'
  const duration = fmtDuration(execution?.started_at, execution?.finished_at)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {STATUS_ICON[status as keyof typeof STATUS_ICON]}
            <span className="font-semibold">Execution Logları</span>
            {execution && (
              <span className="text-sm text-muted-foreground">
                — {execution.rows_processed.toLocaleString('tr-TR')} satır
              </span>
            )}
            {/* Başlangıç / bitiş saati */}
            {execution?.started_at && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-2 py-0.5">
                <Clock className="h-3 w-3" />
                {fmtDateTime(execution.started_at)}
                {execution.finished_at && (
                  <> → {fmtDateTime(execution.finished_at)} <span className="text-primary font-mono">({duration})</span></>
                )}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Log output */}
        <div className="h-80 overflow-auto bg-zinc-950 dark:bg-[#0d0d0d] font-mono text-xs p-3 space-y-0.5">
          {logs.map((log, i) => (
            <div key={log.id ?? i} className={`flex gap-2 ${LEVEL_STYLES[log.level] || ''}`}>
              <span className="text-muted-foreground flex-shrink-0">
                {fmtTime(log.created_at)}
              </span>
              {log.node_id && (
                <span className="text-blue-400 flex-shrink-0">
                  [{nodeLabelMap[log.node_id] || log.node_id.slice(0, 8)}]
                </span>
              )}
              <span className="uppercase text-xs flex-shrink-0 opacity-60">{log.level}</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-muted-foreground text-center py-8">Log bekleniyor...</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {execution?.error_message && (
          <div className="border-t border-border bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            Hata: {execution.error_message}
          </div>
        )}
      </div>
    </div>
  )
}
