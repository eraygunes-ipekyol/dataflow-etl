import type { ReactElement } from 'react'
import { Activity, Database, GitBranch, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useConnections } from '@/hooks/useConnections'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useExecutions } from '@/hooks/useExecutions'
import { useSchedules } from '@/hooks/useSchedules'

const STATUS_ICON: Record<string, ReactElement> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />,
  pending: <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />,
  cancelled: <XCircle className="h-4 w-4 text-yellow-500" />,
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Başarılı',
  failed: 'Başarısız',
  running: 'Çalışıyor',
  pending: 'Bekliyor',
  cancelled: 'İptal',
}

export default function DashboardPage() {
  const { data: connections = [] } = useConnections()
  const { data: workflows = [] } = useWorkflows()
  const { data: executions = [] } = useExecutions()
  const { data: schedules = [] } = useSchedules()

  const stats = [
    { label: 'Bağlantılar', value: connections.length, icon: Database, color: 'text-blue-400' },
    { label: 'Workflowlar', value: workflows.length, icon: GitBranch, color: 'text-green-400' },
    { label: 'Çalıştırmalar', value: executions.length, icon: Activity, color: 'text-yellow-400' },
    { label: 'Zamanlamalar', value: schedules.filter((s) => s.is_active).length, icon: Clock, color: 'text-purple-400' },
  ]

  const recentExecutions = executions.slice(0, 10)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">DataFlow ETL genel bakış</p>
      </div>

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
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Son Çalıştırmalar</h2>
        </div>
        {recentExecutions.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            Henüz çalıştırma yok. Bir workflow oluşturup çalıştırarak başlayın.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Durum</th>
                <th className="px-4 py-2 text-left font-medium">Workflow ID</th>
                <th className="px-4 py-2 text-left font-medium">Tetikleyici</th>
                <th className="px-4 py-2 text-left font-medium">Satır</th>
                <th className="px-4 py-2 text-left font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {recentExecutions.map((exec) => (
                <tr key={exec.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {STATUS_ICON[exec.status] ?? null}
                      <span className="text-xs">{STATUS_LABEL[exec.status] ?? exec.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {exec.workflow_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2 text-xs capitalize">{exec.trigger_type}</td>
                  <td className="px-4 py-2 text-xs">{exec.rows_processed.toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(exec.created_at).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
