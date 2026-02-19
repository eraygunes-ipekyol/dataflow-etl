import { useMemo } from 'react'
import { X, Plus, Minus, Pencil, ArrowRight } from 'lucide-react'
import type { AuditLog } from '@/types/audit_log'

interface Props {
  log: AuditLog
  onClose: () => void
}

interface NodeSummary {
  id: string
  label: string
  type: string
}

function extractNodes(definition: Record<string, unknown> | null): NodeSummary[] {
  if (!definition) return []
  const nodes = (definition.nodes ?? []) as Array<Record<string, unknown>>
  return nodes.map((n) => ({
    id: (n.id as string) ?? '',
    label: ((n.data as Record<string, unknown>)?.label as string) ?? (n.id as string)?.slice(0, 8) ?? '?',
    type: (n.type as string) ?? 'unknown',
  }))
}

function extractEdges(definition: Record<string, unknown> | null): Array<{ source: string; target: string }> {
  if (!definition) return []
  const edges = (definition.edges ?? []) as Array<Record<string, unknown>>
  return edges.map((e) => ({
    source: (e.source as string) ?? '',
    target: (e.target as string) ?? '',
  }))
}

/** Node'un config detaylarını kıyaslar */
function diffNodeDetails(
  oldNode: Record<string, unknown> | undefined,
  newNode: Record<string, unknown> | undefined
): string[] {
  if (!oldNode || !newNode) return []
  const changes: string[] = []

  const oldData = (oldNode.data ?? {}) as Record<string, unknown>
  const newData = (newNode.data ?? {}) as Record<string, unknown>

  // Label değişti mi?
  if (oldData.label !== newData.label) {
    changes.push(`Etiket: "${oldData.label}" → "${newData.label}"`)
  }

  // Position değişti mi?
  const oldPos = oldNode.position as { x: number; y: number } | undefined
  const newPos = newNode.position as { x: number; y: number } | undefined
  if (oldPos && newPos && (Math.abs(oldPos.x - newPos.x) > 5 || Math.abs(oldPos.y - newPos.y) > 5)) {
    changes.push('Konum değişti')
  }

  // Config değişiklikleri
  const oldConfig = JSON.stringify(oldData.config ?? {})
  const newConfig = JSON.stringify(newData.config ?? {})
  if (oldConfig !== newConfig) {
    changes.push('Yapılandırma değişti')
  }

  // Disabled durumu
  if (oldData.disabled !== newData.disabled) {
    changes.push(newData.disabled ? 'Devre dışı bırakıldı' : 'Etkinleştirildi')
  }

  return changes
}

export default function WorkflowDiffViewer({ log, onClose }: Props) {
  const oldDef = (log.old_value?.definition ?? null) as Record<string, unknown> | null
  const newDef = (log.new_value?.definition ?? null) as Record<string, unknown> | null

  const diff = useMemo(() => {
    const oldNodes = extractNodes(oldDef)
    const newNodes = extractNodes(newDef)
    const oldEdges = extractEdges(oldDef)
    const newEdges = extractEdges(newDef)

    const oldNodeMap = new Map(oldNodes.map((n) => [n.id, n]))
    const newNodeMap = new Map(newNodes.map((n) => [n.id, n]))

    // Raw node maps for detail comparison
    const oldRawNodes = ((oldDef?.nodes ?? []) as Array<Record<string, unknown>>)
    const newRawNodes = ((newDef?.nodes ?? []) as Array<Record<string, unknown>>)
    const oldRawMap = new Map(oldRawNodes.map((n) => [n.id as string, n]))
    const newRawMap = new Map(newRawNodes.map((n) => [n.id as string, n]))

    const added = newNodes.filter((n) => !oldNodeMap.has(n.id))
    const removed = oldNodes.filter((n) => !newNodeMap.has(n.id))
    const modified: Array<{ node: NodeSummary; changes: string[] }> = []

    for (const newNode of newNodes) {
      if (!oldNodeMap.has(newNode.id)) continue
      const changes = diffNodeDetails(oldRawMap.get(newNode.id), newRawMap.get(newNode.id))
      if (changes.length > 0) {
        modified.push({ node: newNode, changes })
      }
    }

    // Edge diff
    const oldEdgeSet = new Set(oldEdges.map((e) => `${e.source}→${e.target}`))
    const newEdgeSet = new Set(newEdges.map((e) => `${e.source}→${e.target}`))
    const addedEdges = newEdges.filter((e) => !oldEdgeSet.has(`${e.source}→${e.target}`))
    const removedEdges = oldEdges.filter((e) => !newEdgeSet.has(`${e.source}→${e.target}`))

    // Node label resolver
    const allNodeMap = new Map([...oldNodeMap, ...newNodeMap])
    const resolveLabel = (id: string) => allNodeMap.get(id)?.label ?? id.slice(0, 8)

    return { added, removed, modified, addedEdges, removedEdges, resolveLabel, oldNodes, newNodes }
  }, [oldDef, newDef])

  const hasChanges =
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.modified.length > 0 ||
    diff.addedEdges.length > 0 ||
    diff.removedEdges.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
          <div>
            <span className="font-semibold">Versiyon Karşılaştırma</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {log.old_value && 'version' in log.old_value && (
                <span>v{String(log.old_value.version)}</span>
              )}
              <ArrowRight className="h-3 w-3" />
              {log.new_value && 'version' in log.new_value && (
                <span>v{String(log.new_value.version)}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!hasChanges ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {!oldDef || !newDef
                ? 'Bu kayıtta karşılaştırma yapılamıyor (definition verisi eksik).'
                : 'Bu güncelleme node/edge yapısını değiştirmemiş.'}
            </div>
          ) : (
            <>
              {/* Eklenen node'lar */}
              {diff.added.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Eklenen Node'lar ({diff.added.length})
                  </h3>
                  <div className="space-y-1">
                    {diff.added.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-green-400">{n.label}</span>
                        <span className="text-xs text-muted-foreground">({n.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Silinen node'lar */}
              {diff.removed.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                    <Minus className="h-3.5 w-3.5" />
                    Silinen Node'lar ({diff.removed.length})
                  </h3>
                  <div className="space-y-1">
                    {diff.removed.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-red-400 line-through">{n.label}</span>
                        <span className="text-xs text-muted-foreground">({n.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Değişen node'lar */}
              {diff.modified.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                    Değişen Node'lar ({diff.modified.length})
                  </h3>
                  <div className="space-y-1">
                    {diff.modified.map(({ node, changes }) => (
                      <div
                        key={node.id}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-amber-400">{node.label}</span>
                          <span className="text-xs text-muted-foreground">({node.type})</span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {changes.map((c, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="text-amber-400/60">•</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edge değişiklikleri */}
              {(diff.addedEdges.length > 0 || diff.removedEdges.length > 0) && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">
                    Bağlantı Değişiklikleri
                  </h3>
                  <div className="space-y-1">
                    {diff.addedEdges.map((e, i) => (
                      <div
                        key={`add-${i}`}
                        className="flex items-center gap-1.5 text-xs text-green-400 rounded px-2 py-1 bg-green-500/5"
                      >
                        <Plus className="h-3 w-3" />
                        {diff.resolveLabel(e.source)} → {diff.resolveLabel(e.target)}
                      </div>
                    ))}
                    {diff.removedEdges.map((e, i) => (
                      <div
                        key={`rem-${i}`}
                        className="flex items-center gap-1.5 text-xs text-red-400 rounded px-2 py-1 bg-red-500/5"
                      >
                        <Minus className="h-3 w-3" />
                        {diff.resolveLabel(e.source)} → {diff.resolveLabel(e.target)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Özet */}
              <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Önceki: {diff.oldNodes?.length ?? '?'} node → Sonraki: {diff.newNodes?.length ?? '?'} node
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
