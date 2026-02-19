import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useExecutionTimeline } from '@/hooks/useExecutions'
import { Loader2, Clock, BarChart3 } from 'lucide-react'
import type { TimelineNodeEntry } from '@/types/execution'

interface Props {
  executionId: string
}

const STATUS_COLORS: Record<string, string> = {
  success: '#22c55e',
  failed: '#ef4444',
}

function fmtDurationShort(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}dk ${s}s`
}

export default function ExecutionTimeline({ executionId }: Props) {
  const { data: timeline, isLoading, isError } = useExecutionTimeline(executionId)

  // Gantt verisi: her node için başlangıç offset (saniye) ve süre
  const chartData = useMemo(() => {
    if (!timeline?.nodes.length) return []
    const baseTime = timeline.started_at ? new Date(timeline.started_at).getTime() : 0

    return timeline.nodes.map((node: TimelineNodeEntry) => {
      const startOffset = baseTime ? (new Date(node.start_time).getTime() - baseTime) / 1000 : 0
      return {
        name: node.node_label,
        node_id: node.node_id,
        startOffset: Math.max(0, startOffset),
        duration: Math.max(0.5, node.duration_seconds), // minimum 0.5s bar genişliği
        status: node.status,
        row_count: node.row_count,
        rawDuration: node.duration_seconds,
      }
    })
  }, [timeline])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Timeline yükleniyor...
      </div>
    )
  }

  if (isError || !timeline) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Timeline verisi yüklenemedi.
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Bu execution için timeline verisi yok.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Özet */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>{chartData.length} node</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>Toplam: {fmtDurationShort(timeline.total_duration_seconds)}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500" />
            Başarılı
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
            Hatalı
          </span>
        </div>
      </div>

      {/* Gantt Chart */}
      <div style={{ height: Math.max(120, chartData.length * 40 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
            barCategoryGap="20%"
          >
            <XAxis
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={(v) => fmtDurationShort(v)}
              fontSize={11}
              stroke="#666"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              fontSize={11}
              stroke="#888"
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const data = payload[0].payload
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
                    <p className="font-semibold mb-1">{data.name}</p>
                    <p>Süre: <span className="font-mono">{fmtDurationShort(data.rawDuration)}</span></p>
                    <p>Başlangıç: <span className="font-mono">+{fmtDurationShort(data.startOffset)}</span></p>
                    {data.row_count > 0 && (
                      <p>Satır: <span className="font-mono text-green-400">{data.row_count.toLocaleString('tr-TR')}</span></p>
                    )}
                    <p className={data.status === 'failed' ? 'text-red-400' : 'text-green-400'}>
                      {data.status === 'failed' ? '✗ Hatalı' : '✓ Başarılı'}
                    </p>
                  </div>
                )
              }}
            />
            {/* Offset (boşluk) barı — şeffaf */}
            <Bar dataKey="startOffset" stackId="a" fill="transparent" radius={0} />
            {/* Asıl süre barı */}
            <Bar dataKey="duration" stackId="a" radius={[0, 4, 4, 0]} minPointSize={4}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLORS[entry.status] ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Node detay tablosu */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/20 border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Node</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Süre</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Satır</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">Durum</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((node) => (
              <tr key={node.node_id} className="border-b border-border last:border-0 hover:bg-muted/10">
                <td className="px-3 py-1.5 font-medium">{node.name}</td>
                <td className="px-3 py-1.5 text-right font-mono text-primary">
                  {fmtDurationShort(node.rawDuration)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-green-400">
                  {node.row_count > 0 ? node.row_count.toLocaleString('tr-TR') : '—'}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    node.status === 'failed' ? 'bg-red-500' : 'bg-green-500'
                  }`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
