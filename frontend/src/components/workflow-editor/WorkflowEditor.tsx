import { useCallback, useState, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  BackgroundVariant,
  MarkerType,
} from 'reactflow'
import type { Node, Edge, Connection, NodeMouseHandler, DefaultEdgeOptions, EdgeTypes } from 'reactflow'
import 'reactflow/dist/style.css'
import { Save, CheckCircle2, FileJson, Pencil, Check, X, History } from 'lucide-react'
import { toast } from 'sonner'
import {
  useUpdateWorkflow,
  useRenameWorkflow,
  useValidateWorkflow,
  useExportWorkflow,
} from '@/hooks/useWorkflows'
import type { Workflow, WorkflowNode } from '@/types/workflow'
import NodePanel from './NodePanel'
import { NODE_TYPES } from './nodes'
import DeletableEdge from './edges/DeleteableEdge'
import NodeConfigPanel from '@/components/mapping/NodeConfigPanel'
import RunButton from '@/components/executions/RunButton'
import ExecutionLogViewer from '@/components/executions/ExecutionLogViewer'

interface Props {
  workflow: Workflow
}

// Edge türleri — component dışında tanımla
const EDGE_TYPES: EdgeTypes = {
  deletable: DeletableEdge,
}

// Mevcut edge'leri deletable tipine çevir (geriye dönük uyumluluk)
function normEdges(rawEdges: unknown[]) {
  return (rawEdges as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    type: 'deletable',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
    style: { stroke: '#6366f1', strokeWidth: 2 },
  }))
}

export default function WorkflowEditor({ workflow }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.definition.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    normEdges(workflow.definition.edges) as never[]
  )
  const [saving, setSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null)
  // Son tamamlanan execution ID'sini sakla — "Son Çalışma" butonu için
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(workflow.name)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Canlı execution durumu: aktif node_id ve node başına satır sayısı
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [nodeRowCounts, setNodeRowCounts] = useState<Record<string, number>>({})

  const updateWorkflow = useUpdateWorkflow()
  const renameWorkflow = useRenameWorkflow()
  const validateWorkflow = useValidateWorkflow()
  const exportWorkflow = useExportWorkflow()

  // ── WebSocket: aktif node & satır sayılarını takip et ───────────────────
  useEffect(() => {
    if (!activeExecutionId) return

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${wsProto}://${window.location.host}/ws/api/v1/executions/ws/${activeExecutionId}/logs`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string
          node_id?: string
          message?: string
          level?: string
        }

        // Execution bitti — aktif node temizle
        if (data.type === 'done') {
          setActiveNodeId(null)
          setLastExecutionId(activeExecutionId)
          return
        }

        // Aktif node'u güncelle
        if (data.node_id) {
          setActiveNodeId(data.node_id)

          // "X satır yazıldı" veya "X satır okundu" log mesajlarından sayı çek
          if (data.message) {
            const writeMatch = data.message.match(/(\d+)\s+satır\s+yazıldı/)
            const readMatch  = data.message.match(/^Chunk\s+\d+:\s+(\d+)\s+satır\s+okundu/)
            const count = writeMatch?.[1] ?? readMatch?.[1]
            if (count) {
              const n = parseInt(count, 10)
              setNodeRowCounts((prev) => ({
                ...prev,
                [data.node_id!]: (prev[data.node_id!] ?? 0) + n,
              }))
            }
          }
        }
      } catch {
        // JSON parse hatası — yoksay
      }
    }

    ws.onclose = () => {
      setActiveNodeId(null)
    }

    return () => {
      ws.close()
      setActiveNodeId(null)
    }
  }, [activeExecutionId])

  // Varsayılan edge stili — deletable tipinde, oklu, animasyonlu
  const defaultEdgeOptions: DefaultEdgeOptions = {
    type: 'deletable',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
    style: { stroke: '#6366f1', strokeWidth: 2 },
  }

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'deletable',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
            style: { stroke: '#6366f1', strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  )

  // Manuel kaydetme fonksiyonu
  const handleSave = async () => {
    setSaving(true)
    try {
      await updateWorkflow.mutateAsync({
        id: workflow.id,
        data: {
          definition: {
            nodes: nodes as never[],
            edges: edges as never[],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        },
      })
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+S / Cmd+S kısayolu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const handleValidate = async () => {
    const result = await validateWorkflow.mutateAsync(workflow.id)
    if (!result.valid) {
      result.errors.forEach((err: string) => toast.error(err))
    } else if (result.warnings.length > 0) {
      result.warnings.forEach((w: string) => toast.warning(w))
    } else {
      toast.success('Workflow geçerli — hata yok')
    }
  }

  const handleExport = async () => {
    await exportWorkflow.mutateAsync({
      id: workflow.id,
      filename: `${workflow.name}.json`,
    })
  }

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNode(node as unknown as WorkflowNode)
    },
    []
  )

  const onEdgeMouseEnter = useCallback((_: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id)
  }, [])

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null)
  }, [])

  // hoveredEdgeId + aktif node → edge renk & animasyon
  const edgesWithHover = edges.map((e) => {
    // Aktif node'a giren veya aktif node'dan çıkan edge'i yeşil yap
    const isActive = !!activeNodeId && (e.target === activeNodeId || e.source === activeNodeId)
    return {
      ...e,
      animated: true,
      style: isActive
        ? { stroke: '#22c55e', strokeWidth: 3 }           // yeşil, kalın
        : { stroke: '#6366f1', strokeWidth: 2 },           // mor, normal
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: isActive ? '#22c55e' : '#6366f1',
      },
      data: { ...(e.data ?? {}), hovered: e.id === hoveredEdgeId },
    }
  })

  // Nodes'a canlı satır sayısı ve aktif flag ekle
  const nodesWithLive = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      _liveRows:    nodeRowCounts[n.id] ?? null,
      _isActive:    n.id === activeNodeId,
    },
  }))

  const handleNodeSave = async (updatedNode: WorkflowNode) => {
    // Önce React state'i güncelle
    const updatedNodes = nodes.map((n) =>
      n.id === updatedNode.id ? { ...n, data: updatedNode.data } : n
    )
    setNodes(updatedNodes)
    setSelectedNode(null)

    // Hemen backend'e kaydet — config kaybolmasın
    try {
      await updateWorkflow.mutateAsync({
        id: workflow.id,
        data: {
          definition: {
            nodes: updatedNodes as never[],
            edges: edges as never[],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        },
      })
    } catch {
      // kaydetme hatası toast ile gösterilir (hook içinde)
    }
  }

  const handleAddNode = (type: string) => {
    const labelMap: Record<string, string> = {
      source: 'Source',
      destination: 'Destination',
      transform: 'Transform',
      filter: 'Filter',
      join: 'Join',
      workflowRef: 'Workflow Ref',
      sqlExecute: 'SQL Execute',
    }
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 300 + Math.random() * 200, y: 150 + Math.random() * 150 },
      data: { label: labelMap[type] ?? type, config: {}, disabled: false },
    }
    setNodes((nds) => [...nds, newNode])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {renamingTitle ? (
            <>
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const name = titleDraft.trim()
                    if (name && name !== workflow.name) {
                      renameWorkflow.mutate({ id: workflow.id, name })
                    }
                    setRenamingTitle(false)
                  }
                  if (e.key === 'Escape') {
                    setTitleDraft(workflow.name)
                    setRenamingTitle(false)
                  }
                }}
                onBlur={() => {
                  const name = titleDraft.trim()
                  if (name && name !== workflow.name) {
                    renameWorkflow.mutate({ id: workflow.id, name })
                  }
                  setRenamingTitle(false)
                }}
                autoFocus
                className="text-xl font-bold bg-background border border-primary rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
              />
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  const name = titleDraft.trim()
                  if (name && name !== workflow.name) {
                    renameWorkflow.mutate({ id: workflow.id, name })
                  }
                  setRenamingTitle(false)
                }}
                className="rounded-lg p-1 bg-green-600/10 hover:bg-green-600/20 text-green-500"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  setTitleDraft(workflow.name)
                  setRenamingTitle(false)
                }}
                className="rounded-lg p-1 bg-red-600/10 hover:bg-red-600/20 text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-muted/50 transition-colors"
              onClick={() => {
                setTitleDraft(workflow.name)
                setRenamingTitle(true)
                setTimeout(() => {
                  titleInputRef.current?.focus()
                  titleInputRef.current?.select()
                }, 0)
              }}
              title="Adı değiştir"
            >
              <h1 className="text-xl font-bold">{workflow.name}</h1>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          {workflow.description && !renamingTitle && (
            <p className="text-sm text-muted-foreground truncate">{workflow.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RunButton
            workflowId={workflow.id}
            onStarted={(id) => {
              setNodeRowCounts({})   // önceki sayaçları sıfırla
              setActiveExecutionId(id)
            }}
          />
          {/* Son çalışma butonu — sadece tamamlanmış execution varsa göster */}
          {lastExecutionId && !activeExecutionId && (
            <button
              onClick={() => setActiveExecutionId(lastExecutionId)}
              title="Son çalışmanın loglarını görüntüle"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <History className="h-4 w-4" />
              Son Çalışma
            </button>
          )}
          <div className="w-px h-6 bg-border" />
          <button
            onClick={handleValidate}
            disabled={validateWorkflow.isPending}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Doğrula
          </button>
          <button
            onClick={handleExport}
            disabled={exportWorkflow.isPending}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <FileJson className="h-4 w-4" />
            Dışa Aktar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex">
        {/* Node Panel */}
        <NodePanel onAddNode={handleAddNode} />

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodesWithLive}
            edges={edgesWithHover}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode="Delete"
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="bg-background border border-border"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Node config side panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          allNodes={nodes as unknown as WorkflowNode[]}
          edges={edges.map((e) => ({ source: e.source, target: e.target }))}
          onClose={() => setSelectedNode(null)}
          onSave={handleNodeSave}
        />
      )}

      {/* Canlı log viewer */}
      {activeExecutionId && (
        <ExecutionLogViewer
          executionId={activeExecutionId}
          onClose={() => setActiveExecutionId(null)}
          nodes={nodes.map((n) => ({ id: n.id, label: (n.data as { label?: string }).label }))}
        />
      )}
    </div>
  )
}
