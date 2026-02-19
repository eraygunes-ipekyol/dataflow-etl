import { memo } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import type { NodeProps } from 'reactflow'
import {
  Database,
  Server,
  Globe,
  ArrowRightToLine,
  Shuffle,
  SlidersHorizontal,
  Combine,
  Workflow,
  X,
  Terminal,
  Copy,
  PowerOff,
} from 'lucide-react'

const nodeBase =
  'rounded-xl border-2 px-4 py-3 min-w-[190px] shadow-lg text-sm font-medium relative group'

// Handle ortak stil
const handleStyle = { width: 14, height: 14, border: '2px solid' }

// ---- Canlı çalışma badge'i (aktif node göstergesi + satır sayacı) ----
function NodeLiveBadge({ isActive, liveRows }: { isActive?: boolean; liveRows?: number | null }) {
  if (!isActive && !liveRows) return null
  return (
    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 pointer-events-none">
      {isActive && (
        <span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg animate-pulse">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white" />
          Çalışıyor
        </span>
      )}
      {liveRows != null && liveRows > 0 && (
        <span className="rounded-full bg-zinc-900 border border-zinc-600 px-2 py-0.5 text-[10px] font-mono text-green-400 shadow">
          {liveRows.toLocaleString('tr-TR')} satır
        </span>
      )}
    </div>
  )
}

// ---- Node aksiyon butonları (sil / pasif / kopyala) ----
function NodeActions({ nodeId, disabled: isDisabled }: { nodeId: string; disabled?: boolean }) {
  const { setNodes, setEdges, getNode } = useReactFlow()

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }

  const handleToggleDisable = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, disabled: !n.data.disabled } }
          : n
      )
    )
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const original = getNode(nodeId)
    if (!original) return
    const newId = `node-${Date.now()}`
    const copy = {
      ...original,
      id: newId,
      position: { x: original.position.x + 30, y: original.position.y + 30 },
      data: {
        ...original.data,
        label: `${original.data.label ?? ''} (Kopya)`,
        disabled: false,
      },
      selected: false,
    }
    setNodes((nds) => [...nds, copy])
  }

  return (
    <>
      {/* Kopyala */}
      <button
        onClick={handleCopy}
        title="Node'u Kopyala"
        className="
          absolute -top-2 right-10 z-10
          w-5 h-5 rounded-full
          bg-indigo-600 border border-indigo-400 text-white
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          shadow-md nodrag
        "
      >
        <Copy className="w-3 h-3" strokeWidth={2.5} />
      </button>

      {/* Pasif/Aktif */}
      <button
        onClick={handleToggleDisable}
        title={isDisabled ? 'Node\'u Aktif Et' : 'Node\'u Pasif Et'}
        className={`
          absolute -top-2 right-4 z-10
          w-5 h-5 rounded-full
          border text-white
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          shadow-md nodrag
          ${isDisabled
            ? 'bg-green-600 border-green-400'
            : 'bg-yellow-600 border-yellow-400'
          }
        `}
      >
        <PowerOff className="w-3 h-3" strokeWidth={2.5} />
      </button>

      {/* Sil */}
      <button
        onClick={handleDelete}
        title="Node'u Sil"
        className="
          absolute -top-2 -right-2 z-10
          w-5 h-5 rounded-full
          bg-red-600 border border-red-400 text-white
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          shadow-md nodrag
        "
      >
        <X className="w-3 h-3" strokeWidth={2.5} />
      </button>
    </>
  )
}

// ---- Bağlantı tipine göre ikon ----
function getConnectionIcon(connectionType?: string, colorClass?: string) {
  const cls = `h-5 w-5 flex-shrink-0 ${colorClass ?? ''}`
  switch (connectionType?.toLowerCase()) {
    case 'mssql':
      return <Server className={cls} />
    case 'bigquery':
      return <Globe className={cls} />
    default:
      return <Database className={cls} />
  }
}

// ======= SOURCE NODE =======
export const SourceNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const connType  = data.config?.connection_type as string | undefined
  const isDisabled = !!data.disabled
  const isActive   = !!data._isActive
  const liveRows   = data._liveRows as number | null | undefined
  return (
    <div
      className={`${nodeBase} bg-blue-950 text-blue-100 transition-all duration-300 ${
        isActive
          ? 'border-green-400 ring-2 ring-green-400/60 shadow-green-900/50 shadow-xl'
          : 'border-blue-500'
      } ${selected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-blue-950' : ''
      } ${isDisabled ? 'opacity-40 grayscale' : ''}`}
    >
      <NodeActions nodeId={id} disabled={isDisabled} />

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#60a5fa', borderColor: '#1d4ed8' }}
      />

      <div className="flex items-center gap-2">
        {getConnectionIcon(connType, isActive ? 'text-green-400' : 'text-blue-400')}
        <div className="min-w-0">
          <div className="truncate font-semibold">{data.label || 'Source'}</div>
          <div className="text-[10px] text-blue-400/70 uppercase tracking-wider">
            {connType ?? 'source'}
          </div>
        </div>
      </div>

      {data.config?.table && (
        <div className="mt-2 text-xs text-blue-300/80 truncate bg-blue-900/40 rounded px-2 py-0.5">
          {data.config.schema ? `${data.config.schema}.` : ''}
          {data.config.table}
        </div>
      )}

      <NodeLiveBadge isActive={isActive} liveRows={liveRows} />

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#60a5fa', borderColor: '#1d4ed8' }}
      />
    </div>
  )
})
SourceNode.displayName = 'SourceNode'

// ======= DESTINATION NODE =======
export const DestinationNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const connType   = data.config?.connection_type as string | undefined
  const isDisabled = !!data.disabled
  const isActive   = !!data._isActive
  const liveRows   = data._liveRows as number | null | undefined
  return (
    <div
      className={`${nodeBase} text-green-100 transition-all duration-300 ${
        isActive
          ? 'bg-green-900 border-green-400 ring-2 ring-green-400/60 shadow-green-900/50 shadow-xl'
          : 'bg-green-950 border-green-500'
      } ${selected ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-green-950' : ''
      } ${isDisabled ? 'opacity-40 grayscale' : ''}`}
    >
      <NodeActions nodeId={id} disabled={isDisabled} />

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#4ade80', borderColor: '#15803d' }}
      />

      <div className="flex items-center gap-2">
        {getConnectionIcon(connType, 'text-green-400')}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{data.label || 'Destination'}</div>
          <div className="text-[10px] text-green-400/70 uppercase tracking-wider">
            {connType ?? 'destination'}
          </div>
        </div>
        <ArrowRightToLine className="h-4 w-4 text-green-500 flex-shrink-0" />
      </div>

      {data.config?.table && (
        <div className="mt-2 text-xs text-green-300/80 truncate bg-green-900/40 rounded px-2 py-0.5">
          {data.config.schema ? `${data.config.schema}.` : ''}
          {data.config.table}
        </div>
      )}

      <NodeLiveBadge isActive={isActive} liveRows={liveRows} />

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#4ade80', borderColor: '#15803d' }}
      />
    </div>
  )
})
DestinationNode.displayName = 'DestinationNode'

// ======= TRANSFORM NODE =======
export const TransformNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const isActive = !!data._isActive
  return (
    <div
      className={`${nodeBase} text-yellow-100 transition-all duration-300 ${
        isActive
          ? 'bg-yellow-900 border-green-400 ring-2 ring-green-400/60'
          : 'bg-yellow-950 border-yellow-500'
      } ${selected ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-yellow-950' : ''
      } ${data.disabled ? 'opacity-40 grayscale' : ''}`}
    >
      <NodeActions nodeId={id} disabled={!!data.disabled} />
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#facc15', borderColor: '#a16207' }}
      />
      <div className="flex items-center gap-2">
        <Shuffle className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-green-400' : 'text-yellow-400'}`} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{data.label || 'Transform'}</div>
          <div className="text-[10px] text-yellow-400/70 uppercase tracking-wider">transform</div>
        </div>
      </div>
      <NodeLiveBadge isActive={isActive} />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#facc15', borderColor: '#a16207' }}
      />
    </div>
  )
})
TransformNode.displayName = 'TransformNode'

// ======= FILTER NODE =======
export const FilterNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const isActive = !!data._isActive
  return (
    <div
      className={`${nodeBase} text-purple-100 transition-all duration-300 ${
        isActive
          ? 'bg-purple-900 border-green-400 ring-2 ring-green-400/60'
          : 'bg-purple-950 border-purple-500'
      } ${selected ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-purple-950' : ''
      } ${data.disabled ? 'opacity-40 grayscale' : ''}`}
    >
      <NodeActions nodeId={id} disabled={!!data.disabled} />
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#c084fc', borderColor: '#7e22ce' }}
      />
      <div className="flex items-center gap-2">
        <SlidersHorizontal className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-green-400' : 'text-purple-400'}`} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{data.label || 'Filter'}</div>
          <div className="text-[10px] text-purple-400/70 uppercase tracking-wider">filter</div>
        </div>
      </div>
      {data.config?.condition && (
        <div className="mt-2 text-xs text-purple-300/80 truncate bg-purple-900/40 rounded px-2 py-0.5 font-mono">
          {String(data.config.condition)}
        </div>
      )}
      <NodeLiveBadge isActive={isActive} />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#c084fc', borderColor: '#7e22ce' }}
      />
    </div>
  )
})
FilterNode.displayName = 'FilterNode'

// ======= JOIN NODE =======
export const JoinNode = memo(({ id, data, selected, isConnectable }: NodeProps) => (
  <div
    className={`${nodeBase} bg-orange-950 border-orange-500 text-orange-100 ${
      selected ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-orange-950' : ''
    } ${data.disabled ? 'opacity-40 grayscale' : ''}`}
  >
    <NodeActions nodeId={id} disabled={!!data.disabled} />

    <Handle
      type="target"
      position={Position.Top}
      id="left"
      isConnectable={isConnectable}
      style={{ ...handleStyle, background: '#fb923c', borderColor: '#9a3412', left: '30%' }}
    />
    <Handle
      type="target"
      position={Position.Top}
      id="right"
      isConnectable={isConnectable}
      style={{ ...handleStyle, background: '#fb923c', borderColor: '#9a3412', left: '70%' }}
    />
    <div className="flex items-center gap-2">
      <Combine className="h-5 w-5 text-orange-400 flex-shrink-0" />
      <div className="min-w-0">
        <div className="truncate font-semibold">{data.label || 'Join'}</div>
        <div className="text-[10px] text-orange-400/70 uppercase tracking-wider">join · 2 inputs</div>
      </div>
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={isConnectable}
      style={{ ...handleStyle, background: '#fb923c', borderColor: '#9a3412' }}
    />
  </div>
))
JoinNode.displayName = 'JoinNode'

// ======= WORKFLOW REF NODE =======
export const WorkflowRefNode = memo(({ id, data, selected, isConnectable }: NodeProps) => (
  <div
    className={`${nodeBase} bg-pink-950 border-pink-500 text-pink-100 ${
      selected ? 'ring-2 ring-pink-400 ring-offset-1 ring-offset-pink-950' : ''
    } ${data.disabled ? 'opacity-40 grayscale' : ''}`}
  >
    <NodeActions nodeId={id} disabled={!!data.disabled} />

    <Handle
      type="target"
      position={Position.Top}
      isConnectable={isConnectable}
      style={{ ...handleStyle, background: '#f472b6', borderColor: '#9d174d' }}
    />
    <div className="flex items-center gap-2">
      <Workflow className="h-5 w-5 text-pink-400 flex-shrink-0" />
      <div className="min-w-0">
        <div className="truncate font-semibold">{data.label || 'Workflow Ref'}</div>
        <div className="text-[10px] text-pink-400/70 uppercase tracking-wider">workflow ref</div>
      </div>
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={isConnectable}
      style={{ ...handleStyle, background: '#f472b6', borderColor: '#9d174d' }}
    />
  </div>
))
WorkflowRefNode.displayName = 'WorkflowRefNode'

// ======= SQL EXECUTE NODE =======
export const SqlExecuteNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const isDisabled = !!data.disabled
  const isActive   = !!data._isActive
  const sql: string = data.config?.sql || ''
  const connType = data.config?.connection_type as string | undefined
  return (
    <div
      className={`${nodeBase} text-rose-100 transition-all duration-300 ${
        isActive
          ? 'bg-rose-900 border-green-400 ring-2 ring-green-400/60'
          : 'bg-rose-950 border-rose-500'
      } ${selected ? 'ring-2 ring-rose-400 ring-offset-1 ring-offset-rose-950' : ''
      } ${isDisabled ? 'opacity-40 grayscale' : ''}`}
    >
      <NodeActions nodeId={id} disabled={isDisabled} />

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#fb7185', borderColor: '#9f1239' }}
      />

      <div className="flex items-center gap-2">
        <Terminal className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-green-400' : 'text-rose-400'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{data.label || 'SQL Execute'}</div>
          <div className="text-[10px] text-rose-400/70 uppercase tracking-wider">
            {connType ? `sql · ${connType}` : 'sql execute'}
          </div>
        </div>
      </div>

      {sql && (
        <div className="mt-2 text-xs text-rose-300/80 truncate bg-rose-900/40 rounded px-2 py-0.5 font-mono">
          {sql.slice(0, 60)}{sql.length > 60 ? '…' : ''}
        </div>
      )}

      <NodeLiveBadge isActive={isActive} />

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#fb7185', borderColor: '#9f1239' }}
      />
    </div>
  )
})
SqlExecuteNode.displayName = 'SqlExecuteNode'

// NodeTypes sabiti — component dışında tanımlanmalı (React Flow uyarısı)
export const NODE_TYPES = {
  source: SourceNode,
  destination: DestinationNode,
  transform: TransformNode,
  filter: FilterNode,
  join: JoinNode,
  workflowRef: WorkflowRefNode,
  sqlExecute: SqlExecuteNode,
} as const
