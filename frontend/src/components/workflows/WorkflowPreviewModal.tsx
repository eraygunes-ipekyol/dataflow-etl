import { useMemo, useState } from 'react'
import {
  X,
  Eye,
  Database,
  Server,
  Globe,
  Shuffle,
  SlidersHorizontal,
  Combine,
  Workflow,
  Terminal,
  ArrowRightToLine,
  ChevronDown,
  ChevronRight,
  Link2,
} from 'lucide-react'
import type { AuditLog } from '@/types/audit_log'

interface Props {
  log: AuditLog
  onClose: () => void
}

interface NodeData {
  id: string
  type: string
  data: Record<string, unknown>
  position: { x: number; y: number }
}

interface EdgeData {
  id: string
  source: string
  target: string
}

// Node tipi için ikon ve renk
function getNodeStyle(type: string) {
  switch (type) {
    case 'source':
      return { icon: Server, color: 'text-blue-400', bg: 'bg-blue-950', border: 'border-blue-500' }
    case 'destination':
      return { icon: ArrowRightToLine, color: 'text-green-400', bg: 'bg-green-950', border: 'border-green-500' }
    case 'transform':
      return { icon: Shuffle, color: 'text-yellow-400', bg: 'bg-yellow-950', border: 'border-yellow-500' }
    case 'filter':
      return { icon: SlidersHorizontal, color: 'text-purple-400', bg: 'bg-purple-950', border: 'border-purple-500' }
    case 'join':
      return { icon: Combine, color: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-500' }
    case 'workflowRef':
      return { icon: Workflow, color: 'text-pink-400', bg: 'bg-pink-950', border: 'border-pink-500' }
    case 'sqlExecute':
      return { icon: Terminal, color: 'text-rose-400', bg: 'bg-rose-950', border: 'border-rose-500' }
    default:
      return { icon: Database, color: 'text-gray-400', bg: 'bg-gray-950', border: 'border-gray-500' }
  }
}

function getNodeTypeLabel(type: string) {
  switch (type) {
    case 'source': return 'Kaynak'
    case 'destination': return 'Hedef'
    case 'transform': return 'Dönüşüm'
    case 'filter': return 'Filtre'
    case 'join': return 'Birleştirme'
    case 'workflowRef': return 'Workflow Referans'
    case 'sqlExecute': return 'SQL Execute'
    default: return type
  }
}

/** Node'un config detaylarını okunabilir key-value listesine çevir */
function extractConfigDetails(node: NodeData): Array<{ key: string; value: string; isCode?: boolean }> {
  const config = (node.data?.config ?? {}) as Record<string, unknown>
  const details: Array<{ key: string; value: string; isCode?: boolean }> = []

  // Bağlantı bilgisi
  if (config.connection_id) {
    details.push({ key: 'Bağlantı ID', value: String(config.connection_id) })
  }
  if (config.connection_type) {
    details.push({ key: 'Bağlantı Tipi', value: String(config.connection_type) })
  }

  // Tablo bilgisi
  if (config.schema) {
    details.push({ key: 'Şema', value: String(config.schema) })
  }
  if (config.table) {
    details.push({ key: 'Tablo', value: String(config.table) })
  }

  // SQL sorgusu
  if (config.sql) {
    details.push({ key: 'SQL', value: String(config.sql), isCode: true })
  }
  if (config.query) {
    details.push({ key: 'Sorgu', value: String(config.query), isCode: true })
  }

  // Filtre koşulu
  if (config.condition) {
    details.push({ key: 'Koşul', value: String(config.condition), isCode: true })
  }

  // Yazma modu
  if (config.write_mode) {
    details.push({ key: 'Yazma Modu', value: String(config.write_mode) })
  }

  // Batch size
  if (config.batch_size) {
    details.push({ key: 'Batch Boyutu', value: String(config.batch_size) })
  }

  // On error
  if (config.on_error) {
    details.push({ key: 'Hata Davranışı', value: String(config.on_error) })
  }

  // Mapping
  if (config.column_mappings && Array.isArray(config.column_mappings)) {
    const mappings = config.column_mappings as Array<Record<string, unknown>>
    if (mappings.length > 0) {
      const mappingStr = mappings
        .map((m) => `${m.source_column ?? '?'} → ${m.target_column ?? '?'}`)
        .join('\n')
      details.push({ key: 'Kolon Mapping', value: mappingStr, isCode: true })
    }
  }

  // Transform fonksiyonları
  if (config.transforms && Array.isArray(config.transforms)) {
    const transforms = config.transforms as Array<Record<string, unknown>>
    if (transforms.length > 0) {
      const txStr = transforms
        .map((t) => `${t.column ?? '?'}: ${t.function ?? t.type ?? '?'}`)
        .join('\n')
      details.push({ key: 'Dönüşümler', value: txStr, isCode: true })
    }
  }

  // Workflow ref
  if (config.workflow_id) {
    details.push({ key: 'Referans Workflow', value: String(config.workflow_id) })
  }

  // Disabled durumu
  if (node.data?.disabled) {
    details.push({ key: 'Durum', value: 'Pasif (Devre dışı)' })
  }

  return details
}

/** Tek bir node kartı */
function NodeCard({ node }: { node: NodeData }) {
  const [expanded, setExpanded] = useState(false)
  const style = getNodeStyle(node.type)
  const Icon = style.icon
  const label = (node.data?.label as string) ?? node.id?.slice(0, 8) ?? '?'
  const details = useMemo(() => extractConfigDetails(node), [node])
  const connType = (node.data?.config as Record<string, unknown>)?.connection_type as string | undefined

  // Bağlantı adı çöz
  const getConnectionIcon = () => {
    switch (connType?.toLowerCase()) {
      case 'mssql': return <Server className="h-4 w-4 flex-shrink-0 text-blue-400" />
      case 'bigquery': return <Globe className="h-4 w-4 flex-shrink-0 text-emerald-400" />
      default: return <Database className="h-4 w-4 flex-shrink-0 text-gray-400" />
    }
  }

  return (
    <div className={`rounded-lg border-2 ${style.border} ${style.bg} overflow-hidden`}>
      {/* Node header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <Icon className={`h-4 w-4 flex-shrink-0 ${style.color}`} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold truncate block">{label}</span>
          <span className={`text-[10px] ${style.color} opacity-70 uppercase tracking-wider`}>
            {getNodeTypeLabel(node.type)}
          </span>
        </div>
        {connType && (
          <div className="flex items-center gap-1 ml-auto">
            {getConnectionIcon()}
            <span className="text-[10px] text-muted-foreground uppercase">{connType}</span>
          </div>
        )}
        {!!node.data?.disabled && (
          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
            Pasif
          </span>
        )}
      </button>

      {/* Node detayları (açılır) */}
      {expanded && details.length > 0 && (
        <div className="border-t border-white/10 px-3 py-2 space-y-2">
          {details.map((d, i) => (
            <div key={i}>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{d.key}</span>
              {d.isCode ? (
                <pre className="mt-0.5 text-xs text-gray-300 bg-black/40 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all font-mono max-h-48 overflow-y-auto">
                  {d.value}
                </pre>
              ) : (
                <p className="text-xs text-gray-300 mt-0.5">{d.value}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* detay yoksa açıldığında bilgilendirme */}
      {expanded && details.length === 0 && (
        <div className="border-t border-white/10 px-3 py-2">
          <p className="text-xs text-muted-foreground italic">Yapılandırma bilgisi yok</p>
        </div>
      )}
    </div>
  )
}

export default function WorkflowPreviewModal({ log, onClose }: Props) {
  // old_value.definition → o versiyondaki workflow tanımı
  const definition = useMemo(() => {
    const val = log.old_value
    if (!val || typeof val !== 'object') return null
    const def = (val as Record<string, unknown>).definition as Record<string, unknown> | undefined
    return def ?? null
  }, [log.old_value])

  const nodes = useMemo(() => {
    if (!definition) return []
    return ((definition.nodes ?? []) as NodeData[])
  }, [definition])

  const edges = useMemo(() => {
    if (!definition) return []
    return ((definition.edges ?? []) as EdgeData[])
  }, [definition])

  const nodeLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes) {
      map.set(n.id, (n.data?.label as string) ?? n.id?.slice(0, 8) ?? '?')
    }
    return map
  }, [nodes])

  const version = log.old_value && typeof log.old_value === 'object' && 'version' in log.old_value
    ? String(log.old_value.version)
    : '?'

  // Node'ları tipe göre grupla
  const groupedNodes = useMemo(() => {
    const groups: Record<string, NodeData[]> = {}
    for (const n of nodes) {
      const type = n.type ?? 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(n)
    }
    return groups
  }, [nodes])

  // Tip sıralama
  const typeOrder = ['source', 'transform', 'filter', 'join', 'destination', 'sqlExecute', 'workflowRef']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <div>
              <span className="font-semibold">Versiyon Önizleme</span>
              <span className="text-xs text-muted-foreground ml-2">v{version}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!definition ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Bu kayıtta workflow tanımı (definition) verisi bulunmuyor.
            </div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Bu versiyonda henüz node tanımlanmamış.
            </div>
          ) : (
            <>
              {/* Özet */}
              <div className="flex items-center gap-4 rounded-lg bg-muted/20 px-4 py-2.5 text-sm">
                <div className="flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="font-medium">{nodes.length}</span>
                  <span className="text-muted-foreground">node</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{edges.length}</span>
                  <span className="text-muted-foreground">bağlantı</span>
                </div>
              </div>

              {/* Node'lar tipe göre gruplu */}
              {typeOrder
                .filter((type) => groupedNodes[type]?.length)
                .map((type) => (
                  <div key={type}>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                      {getNodeTypeLabel(type)} ({groupedNodes[type].length})
                    </h3>
                    <div className="space-y-2">
                      {groupedNodes[type].map((node) => (
                        <NodeCard key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                ))}

              {/* typeOrder'da olmayan tipler */}
              {Object.keys(groupedNodes)
                .filter((type) => !typeOrder.includes(type))
                .map((type) => (
                  <div key={type}>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                      {getNodeTypeLabel(type)} ({groupedNodes[type].length})
                    </h3>
                    <div className="space-y-2">
                      {groupedNodes[type].map((node) => (
                        <NodeCard key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                ))}

              {/* Bağlantılar (Edges) */}
              {edges.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Bağlantılar ({edges.length})
                  </h3>
                  <div className="space-y-1">
                    {edges.map((edge, i) => (
                      <div
                        key={edge.id ?? i}
                        className="flex items-center gap-2 rounded-lg bg-muted/10 px-3 py-1.5 text-xs"
                      >
                        <Link2 className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                        <span className="font-medium text-blue-400">
                          {nodeLabels.get(edge.source) ?? edge.source?.slice(0, 8)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-green-400">
                          {nodeLabels.get(edge.target) ?? edge.target?.slice(0, 8)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
