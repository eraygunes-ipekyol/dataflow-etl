import { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Eye, Loader2, ChevronDown, ChevronUp, Code2, Table2,
  AlertCircle, GitMerge, Settings2, Zap, RefreshCw,
} from 'lucide-react'
import { useConnections, useSchemas, useTables, useColumns } from '@/hooks/useConnections'
import { usePreviewTable, usePreviewQuery, useQueryColumns } from '@/hooks/useDataPreview'
import ColumnMappingEditor from './ColumnMappingEditor'
import DataPreviewTable from '@/components/data-preview/DataPreviewTable'
import SqlEditor from '@/components/editor/SqlEditor'
import type { WorkflowNode, ColumnMapping, DataType } from '@/types/workflow'
import type { PreviewResponse } from '@/types/dataPreview'
import type { ColumnInfo } from '@/types/connection'

interface Props {
  node: WorkflowNode
  allNodes: WorkflowNode[]
  edges: { source: string; target: string }[]
  onClose: () => void
  onSave: (node: WorkflowNode) => void
}

/** Upstream'de kaynak (source) node'u bul — transform/filter zincirini atlayarak */
function findUpstreamSource(
  nodeId: string,
  allNodes: WorkflowNode[],
  edges: { source: string; target: string }[],
  depth = 0,
): WorkflowNode | null {
  if (depth > 10) return null
  const upstreamIds = edges.filter((e) => e.target === nodeId).map((e) => e.source)
  for (const uid of upstreamIds) {
    const n = allNodes.find((x) => x.id === uid)
    if (!n) continue
    if (n.type === 'source') return n
    if (n.type === 'transform' || n.type === 'filter') {
      const deeper = findUpstreamSource(n.id, allNodes, edges, depth + 1)
      if (deeper) return deeper
    }
  }
  return null
}

/* ─── Connector tip uyumluluk matrisi ────────────────────────────────── */
/**
 * Kaynak tip adını (ham DB tipi) DataType'a normalize eder.
 * srcConnType: 'mssql' | 'bigquery'
 */
function normalizeSrcType(rawType: string, srcConnType: string): DataType | null {
  const t = rawType.toLowerCase().trim()
  if (srcConnType === 'mssql') {
    if (['int', 'bigint', 'smallint', 'tinyint'].some((x) => t === x)) return 'integer'
    if (['numeric', 'decimal', 'money', 'smallmoney'].some((x) => t === x)) return 'float'
    if (['float', 'real'].some((x) => t === x)) return 'float'
    if (['char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext'].some((x) => t === x)) return 'string'
    if (t === 'bit') return 'boolean'
    if (t === 'date') return 'date'
    if (['datetime', 'datetime2', 'smalldatetime'].some((x) => t === x)) return 'datetime'
    if (t === 'time') return 'string'
    if (t === 'uniqueidentifier') return 'string'
  }
  if (srcConnType === 'bigquery') {
    if (['integer', 'int64', 'int', 'smallint', 'bigint', 'tinyint', 'byteint'].some((x) => t === x)) return 'integer'
    if (['float', 'float64', 'numeric', 'bignumeric', 'decimal', 'bigdecimal'].some((x) => t === x)) return 'float'
    if (['string', 'varchar', 'char', 'bytes'].some((x) => t === x)) return 'string'
    if (t === 'bool' || t === 'boolean') return 'boolean'
    if (t === 'date') return 'date'
    if (['datetime', 'timestamp'].some((x) => t === x)) return 'datetime'
    if (t === 'time') return 'string'
  }
  return null
}

/**
 * Hedef tablo kolon tipini (ham DB tipi) DataType'a normalize eder.
 * dstConnType: 'mssql' | 'bigquery'
 */
function normalizeDstType(rawType: string, dstConnType: string): DataType | null {
  const t = rawType.toLowerCase().trim()
  if (dstConnType === 'mssql') {
    if (['int', 'bigint', 'smallint', 'tinyint'].some((x) => t === x)) return 'integer'
    if (['numeric', 'decimal', 'money', 'smallmoney', 'float', 'real'].some((x) => t === x)) return 'float'
    if (['char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext'].some((x) => t === x)) return 'string'
    if (t === 'bit') return 'boolean'
    if (t === 'date') return 'date'
    if (['datetime', 'datetime2', 'smalldatetime'].some((x) => t === x)) return 'datetime'
    if (t === 'time') return 'string'
    if (t === 'uniqueidentifier') return 'string'
  }
  if (dstConnType === 'bigquery') {
    if (['integer', 'int64', 'int', 'smallint', 'bigint', 'tinyint', 'byteint'].some((x) => t === x)) return 'integer'
    if (['float', 'float64', 'numeric', 'bignumeric', 'decimal', 'bigdecimal'].some((x) => t === x)) return 'float'
    if (['string', 'varchar', 'char', 'bytes'].some((x) => t === x)) return 'string'
    if (t === 'bool' || t === 'boolean') return 'boolean'
    if (t === 'date') return 'date'
    if (['datetime', 'timestamp'].some((x) => t === x)) return 'datetime'
    if (t === 'time') return 'string'
  }
  return null
}

/**
 * Kaynak ve hedef normalize tipler aynıysa cast gerekmez.
 * Farklıysa hedef DataType'ı döndür (bu cast_to değeri olacak).
 */
function suggestCast(
  srcRaw: string, srcConnType: string,
  dstRaw: string, dstConnType: string,
): DataType | null {
  if (!srcRaw || !dstRaw) return null
  const src = normalizeSrcType(srcRaw, srcConnType)
  const dst = normalizeDstType(dstRaw, dstConnType)
  if (!src || !dst) return null
  if (src === dst) return null           // Uyumlu — cast gerekmez
  return dst                              // Hedef tipe cast et
}

/* ─── Toggle bileşeni ─────────────────────────────────────────────────── */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer focus:outline-none ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────────── */
function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  )
}

/* ─── Ana bileşen ─────────────────────────────────────────────────────── */
export default function NodeConfigPanel({ node, allNodes, edges, onClose, onSave }: Props) {
  const isSource      = node.type === 'source'
  const isDestination = node.type === 'destination'
  const isTransform   = node.type === 'transform'
  const isSqlExecute  = node.type === 'sqlExecute'

  const [localNode, setLocalNode] = useState<WorkflowNode>(node)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // ── Resize — pointer capture ile (ReactFlow canvas'ı geçmez) ───────────
  const MIN_WIDTH = 420
  const MAX_WIDTH = 960
  const [panelWidth, setPanelWidth] = useState(580)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const delta = resizeStartX.current - e.clientX      // sola sürükle = genişle
    const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartW.current + delta))
    setPanelWidth(w)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resizeStartX.current = e.clientX
    resizeStartW.current = panelWidth
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  const initCfg = (node.data.config as Record<string, unknown>) || {}

  const [freeSql,       setFreeSql]       = useState<boolean>(
    isSource ? !!(initCfg.query as string | undefined)?.trim() : false
  )
  const [manualTable,   setManualTable]   = useState(false)
  const [mappingEnabled, setMappingEnabled] = useState<boolean>(
    isDestination ? !!((initCfg.column_mappings as ColumnMapping[] | undefined)?.length) : false
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // SQL sorgu modunda yüklenen kaynak kolonlar (manuel tetik)
  const [querySrcColumns, setQuerySrcColumns] = useState<ColumnInfo[]>([])

  const cfg          = (localNode.data.config as Record<string, unknown>) || {}
  const { data: connections } = useConnections()

  const connectionId = cfg.connection_id as string | undefined
  const schemaName   = cfg.schema      as string | undefined
  const tableName    = cfg.table       as string | undefined
  const queryVal     = cfg.query       as string | undefined

  const selectedConn  = connections?.find((c) => c.id === connectionId)
  const isBigQuery    = selectedConn?.type === 'bigquery'
  const schemaLabel   = isBigQuery ? 'Dataset' : 'Şema'
  // Hedef connector tipi (cast önerisi için)
  const dstConnType   = selectedConn?.type ?? 'mssql'

  const { data: schemas,  isLoading: schemasLoading  } = useSchemas(connectionId ?? '')
  const canFetchTables = !!connectionId && !!schemaName
  const { data: tables,   isLoading: tablesLoading   } = useTables(connectionId ?? '', schemaName ?? '', canFetchTables)

  // ── Upstream source tespiti (transform & destination) ───────────────────
  const upstreamSourceNode = (isTransform || isDestination)
    ? findUpstreamSource(node.id, allNodes, edges)
    : null

  const sourceCfg  = (upstreamSourceNode?.data?.config as Record<string, unknown>) || {}
  const srcConnId  = sourceCfg.connection_id as string | undefined
  const srcSchema  = sourceCfg.schema        as string | undefined
  const srcTable   = sourceCfg.table         as string | undefined
  const srcQuery   = sourceCfg.query         as string | undefined

  // Kaynak connector tipi — srcConnId tanımlandıktan sonra
  const srcConnObj    = connections?.find((c) => c.id === srcConnId)
  const srcConnType   = srcConnObj?.type ?? 'mssql'

  // Kaynak kolonları: tablo seçiliyse API'den, SQL sorgu modunda manuel yüklenen
  const canFetchSrcCols = !!(isTransform || isDestination) && !!srcConnId && !!srcTable && !srcQuery
  const { data: srcTableColumns, isLoading: srcColsLoading } = useColumns(
    srcConnId ?? '', srcTable ?? '', srcSchema ?? ''
  )
  const sourceColumns = (() => {
    if (canFetchSrcCols && srcTableColumns) {
      return srcTableColumns.map((c) => ({ name: c.name, type: c.data_type }))
    }
    // SQL sorgu modunda: manuel yüklenen kolonlar
    if (srcQuery && querySrcColumns.length > 0) {
      return querySrcColumns.map((c) => ({ name: c.name, type: c.data_type }))
    }
    return []
  })()

  // Hedef tablo kolonları (destination + tablo seçildiyse)
  const canFetchDstCols = isDestination && !!connectionId && !!tableName
  const { data: dstColumns, isLoading: dstColsLoading } = useColumns(
    connectionId ?? '', tableName ?? '', schemaName ?? ''
  )

  const previewTableMut  = usePreviewTable()
  const previewQueryMut  = usePreviewQuery()
  const queryColumnsMut  = useQueryColumns()
  const isPreviewing     = previewTableMut.isPending || previewQueryMut.isPending
  const isLoadingQCols   = queryColumnsMut.isPending

  /* ── Config güncelle ────────────────────────────────────────────────── */
  const updateConfig = (updates: Record<string, unknown>) => {
    setLocalNode((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        config: { ...(prev.data.config as Record<string, unknown>), ...updates },
      },
    }))
    setPreviewData(null)
    setPreviewOpen(false)
  }

  /* ── Önizleme ───────────────────────────────────────────────────────── */
  const handlePreview = async () => {
    if (!connectionId) return
    try {
      let result: PreviewResponse
      if (freeSql && queryVal?.trim()) {
        result = await previewQueryMut.mutateAsync({ connection_id: connectionId, query: queryVal.trim(), limit: 50 })
      } else if (tableName) {
        result = await previewTableMut.mutateAsync({ connection_id: connectionId, schema_name: schemaName ?? '', table_name: tableName, limit: 50 })
      } else return
      setPreviewData(result)
      setPreviewOpen(true)
    } catch { /* hook toast gösterir */ }
  }

  /* ── SQL sorgu modunda kaynak kolonları yükle ───────────────────────── */
  const handleLoadQueryColumns = async (connId: string, query: string) => {
    if (!connId || !query?.trim()) return
    try {
      const cols = await queryColumnsMut.mutateAsync({ connection_id: connId, query: query.trim() })
      setQuerySrcColumns(cols)
    } catch { /* hata toast'la gösterilir */ }
  }

  /* ── Panel açıldığında SQL sorgu modundaysa kolonları otomatik yükle ── */
  useEffect(() => {
    if (srcQuery && srcConnId && querySrcColumns.length === 0) {
      handleLoadQueryColumns(srcConnId, srcQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcConnId, srcQuery])

  /* ── Akıllı otomatik eşleme (connector tipine göre otomatik cast) ────── */
  const handleAutoMap = () => {
    const srcCols = sourceColumns
    const dstCols = dstColumns?.map((c) => ({ name: c.name, type: c.data_type })) ?? []

    if (srcCols.length === 0) return

    const mapped: ColumnMapping[] = srcCols.map((sc) => {
      // Hedef tabloda aynı isimli kolon var mı?
      const dstMatch = dstCols.find(
        (dc) => dc.name.toLowerCase() === sc.name.toLowerCase()
      )

      // Tip uyumluluk kontrolü — connector tiplerine göre cast gerekiyor mu?
      const castTo = dstMatch?.type
        ? suggestCast(sc.type ?? '', srcConnType, dstMatch.type, dstConnType)
        : null

      return {
        source_column: sc.name,
        target_column: dstMatch?.name ?? sc.name,
        transforms: castTo ? [{ type: 'cast' as const, cast_to: castTo }] : [],
        skip: false,
        source_type: sc.type || undefined,
        target_type: dstMatch?.type || undefined,
      }
    })
    updateConfig({ column_mappings: mapped })
  }

  const canPreview = isSource && !!connectionId && (
    (freeSql && !!queryVal?.trim()) || (!freeSql && !!tableName)
  )
  const mappings = (cfg.column_mappings as ColumnMapping[]) || []

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-y-0 right-0 z-40 border-l border-border bg-card shadow-xl flex flex-col"
      style={{ width: panelWidth }}
    >
      {/* ── Resize handle (sol kenar, pointer capture ile) ── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="absolute left-0 inset-y-0 w-2 cursor-ew-resize group z-50 flex items-center justify-center select-none touch-none"
        title="Sürükleyerek genişliği ayarla"
      >
        <div className="w-0.5 h-16 rounded-full bg-border group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold">{localNode.data.label}</h3>
          <p className="text-xs text-muted-foreground capitalize">{localNode.type} node</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* Node Adı */}
        <div>
          <label className="block text-sm font-medium mb-1">Node Adı</label>
          <input
            type="text"
            value={localNode.data.label}
            onChange={(e) =>
              setLocalNode((prev) => ({ ...prev, data: { ...prev.data, label: e.target.value } }))
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* ══════════ SOURCE / DESTINATION ══════════ */}
        {(isSource || isDestination) && (
          <>
            {/* Bağlantı */}
            <div>
              <label className="block text-sm font-medium mb-1">Bağlantı</label>
              <select
                value={connectionId || ''}
                onChange={(e) => {
                  const conn = connections?.find((c) => c.id === e.target.value)
                  updateConfig({
                    connection_id: e.target.value || undefined,
                    connection_type: conn?.type ?? undefined,
                    schema: undefined, table: undefined, query: undefined,
                  })
                  setFreeSql(false)
                  setManualTable(false)
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Bağlantı seç --</option>
                {connections?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>

            {/* ──────── SOURCE ──────── */}
            {isSource && connectionId && (
              <>
                {/* Free SQL Toggle */}
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <Toggle checked={freeSql} onChange={(v) => {
                    setFreeSql(v)
                    if (v) updateConfig({ table: undefined, schema: undefined })
                    else    updateConfig({ query: undefined })
                  }} />
                  <div className="flex items-center gap-2">
                    {freeSql ? <Code2 className="h-4 w-4 text-primary" /> : <Table2 className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">{freeSql ? 'SQL Sorgu Modu' : 'Tablo Seçim Modu'}</span>
                    <span className="text-xs text-muted-foreground">{freeSql ? '— sadece sorgu çalışır' : '— şema/tablo seç'}</span>
                  </div>
                </div>

                {/* Tablo Seçim Modu */}
                {!freeSql && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">{schemaLabel}</label>
                      {schemasLoading
                        ? <Spinner text="Yükleniyor..." />
                        : schemas && schemas.length > 0
                          ? <select value={schemaName || ''} onChange={(e) => updateConfig({ schema: e.target.value || undefined, table: undefined })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                              <option value="">-- {schemaLabel} seç --</option>
                              {schemas.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                          : <input type="text" value={schemaName || ''} onChange={(e) => updateConfig({ schema: e.target.value || undefined, table: undefined })} placeholder={isBigQuery ? 'dataset_adi' : 'dbo'} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      }
                    </div>
                    {!!schemaName && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Tablo</label>
                        {tablesLoading
                          ? <Spinner text="Tablolar yükleniyor..." />
                          : tables && tables.length > 0
                            ? <select value={tableName || ''} onChange={(e) => updateConfig({ table: e.target.value || undefined })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="">-- Tablo seç --</option>
                                {tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                              </select>
                            : <input type="text" value={tableName || ''} onChange={(e) => updateConfig({ table: e.target.value || undefined })} placeholder="tablo_adi" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        }
                      </div>
                    )}
                  </>
                )}

                {/* SQL Sorgu Modu */}
                {freeSql && (
                  <div>
                    <label className="block text-sm font-medium mb-1">SQL Sorgu</label>
                    <SqlEditor
                      value={queryVal || ''}
                      onChange={(val) => {
                        updateConfig({ query: val || undefined })
                        // Sorgu değişince yüklenen kolonları sıfırla
                        setQuerySrcColumns([])
                      }}
                      placeholder={isBigQuery ? 'SELECT * FROM `project.dataset.table`' : 'SELECT * FROM [schema].[table] WITH (NOLOCK) WHERE ...'}
                      minHeight="160px"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="text-primary">Ctrl+Space</span> — otomatik tamamlama
                      </p>
                      {queryVal?.trim() && connectionId && (
                        <button
                          type="button"
                          onClick={() => handleLoadQueryColumns(connectionId, queryVal)}
                          disabled={isLoadingQCols}
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          {isLoadingQCols
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RefreshCw className="h-3 w-3" />}
                          {querySrcColumns.length > 0
                            ? `Kolonları Yenile (${querySrcColumns.length})`
                            : 'Kolonları Yükle'}
                        </button>
                      )}
                    </div>
                    {querySrcColumns.length > 0 && (
                      <p className="text-xs text-green-500 mt-0.5">
                        ✓ {querySrcColumns.length} kolon yüklendi
                      </p>
                    )}
                  </div>
                )}

                {/* Gelişmiş: chunk_size */}
                <div>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Gelişmiş Okuma Ayarları
                    {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {advancedOpen && (
                    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Chunk Boyutu (satır/tur)</label>
                        <input
                          type="number"
                          min={100} max={50000} step={500}
                          value={(cfg.chunk_size as number) || 5000}
                          onChange={(e) => updateConfig({ chunk_size: parseInt(e.target.value) || 5000 })}
                          className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Önerilen: 2000–10000. Bellek/ağ durumuna göre ayarlayın.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Önizleme */}
                {canPreview && (
                  <div className="space-y-2">
                    <button onClick={handlePreview} disabled={isPreviewing} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 w-full justify-center">
                      {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      {isPreviewing ? 'Yükleniyor...' : 'Veriyi Önizle'}
                    </button>
                    {previewData && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <button onClick={() => setPreviewOpen((v) => !v)} className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors">
                          <span>Önizleme — {previewData.total_rows} satır, {previewData.columns.length} kolon{previewData.truncated && ' (sınırlandırılmış)'}</span>
                          {previewOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        {previewOpen && (
                          <div className="p-2 max-h-72 overflow-auto">
                            <DataPreviewTable columns={previewData.columns} rows={previewData.rows} totalRows={previewData.total_rows} truncated={previewData.truncated} />
                          </div>
                        )}
                      </div>
                    )}
                    {(previewTableMut.isError || previewQueryMut.isError) && (
                      <div className="rounded-lg border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                        Önizleme hatası: {String((previewTableMut.error || previewQueryMut.error) as Error)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ──────── DESTINATION ──────── */}
            {isDestination && connectionId && (
              <>
                {/* Şema */}
                <div>
                  <label className="block text-sm font-medium mb-1">{schemaLabel}</label>
                  {schemasLoading
                    ? <Spinner text="Yükleniyor..." />
                    : schemas && schemas.length > 0
                      ? <select value={schemaName || ''} onChange={(e) => updateConfig({ schema: e.target.value || undefined, table: undefined })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                          <option value="">-- {schemaLabel} seç --</option>
                          {schemas.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                      : <input type="text" value={schemaName || ''} onChange={(e) => updateConfig({ schema: e.target.value || undefined, table: undefined })} placeholder={isBigQuery ? 'dataset_adi' : 'dbo'} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  }
                </div>

                {/* Hedef Tablo */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">Hedef Tablo</label>
                    {tables && tables.length > 0 && (
                      <button type="button" onClick={() => setManualTable((v) => !v)} className="text-xs text-primary hover:underline">
                        {manualTable ? '↩ Listeden seç' : '✏ Elle yaz'}
                      </button>
                    )}
                  </div>
                  {tablesLoading
                    ? <Spinner text="Tablolar yükleniyor..." />
                    : !manualTable && tables && tables.length > 0
                      ? <select value={tableName || ''} onChange={(e) => updateConfig({ table: e.target.value || undefined })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                          <option value="">-- Tablo seç --</option>
                          {tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                        </select>
                      : <>
                          <input type="text" value={tableName || ''} onChange={(e) => updateConfig({ table: e.target.value || undefined })} placeholder="hedef_tablo_adi" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          {!tableName && (
                            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Tablo adı girilmeden workflow çalıştırılamaz
                            </p>
                          )}
                        </>
                  }
                </div>

                {/* Yazma Modu */}
                <div>
                  <label className="block text-sm font-medium mb-1">Yazma Modu</label>
                  <select
                    value={(cfg.write_mode as string) || 'append'}
                    onChange={(e) => updateConfig({ write_mode: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="append">Ekle (Append)</option>
                    <option value="overwrite">Üzerine Yaz (Overwrite)</option>
                    <option value="upsert">Güncelle/Ekle (Upsert)</option>
                  </select>
                </div>

                {/* ─── Gelişmiş Yazma Ayarları ──────────────────────────── */}
                <div>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Performans & Hata Yönetimi
                    {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {advancedOpen && (
                    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 grid grid-cols-2 gap-3">
                      {/* Batch Boyutu */}
                      <div>
                        <label className="block text-xs font-medium mb-1 text-muted-foreground">
                          Batch Boyutu
                          <span className="ml-1 text-muted-foreground/60">(INSERT / tur)</span>
                        </label>
                        <input
                          type="number"
                          min={50} max={5000} step={50}
                          value={(cfg.batch_size as number) || 500}
                          onChange={(e) => updateConfig({ batch_size: parseInt(e.target.value) || 500 })}
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">Önerilen: 200–1000</p>
                      </div>

                      {/* Hata Modu */}
                      <div>
                        <label className="block text-xs font-medium mb-1 text-muted-foreground">
                          Batch Hata Davranışı
                        </label>
                        <select
                          value={(cfg.on_error as string) || 'rollback'}
                          onChange={(e) => updateConfig({ on_error: e.target.value })}
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="rollback">Geri Al (Rollback)</option>
                          <option value="continue">Atla & Devam Et</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(cfg.on_error as string) === 'continue'
                            ? 'Hatalı batch atlanır, diğerleri yazılır'
                            : 'Hata olursa tüm işlem geri alınır'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Kolon Eşleme Toggle ──────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <GitMerge className={`h-4 w-4 flex-shrink-0 ${mappingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Kolon Eşleme & Dönüşüm</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {mappingEnabled
                          ? `— aktif (${mappings.filter((m) => !m.skip).length} kolon)`
                          : '— pasif, tüm kolonlar olduğu gibi yazılır'}
                      </span>
                    </div>
                    <Toggle
                      checked={mappingEnabled}
                      onChange={(v) => {
                        setMappingEnabled(v)
                        if (!v) updateConfig({ column_mappings: [] })
                      }}
                    />
                  </div>

                  {/* Mapping paneli */}
                  {mappingEnabled && (
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      {/* Kaynak bilgisi + yükleme durumu */}
                      {upstreamSourceNode ? (
                        <div className="rounded border border-border bg-muted/20 px-2.5 py-2 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">Kaynak:</span>{' '}
                              {upstreamSourceNode.data.label}
                              {srcTable && (
                                <> → <span className="font-mono text-primary">{srcSchema ? `${srcSchema}.` : ''}{srcTable}</span></>
                              )}
                              {srcQuery && <> → <span className="font-mono text-primary">SQL Sorgu</span></>}
                              {!srcTable && !srcQuery && <span className="text-amber-400"> (kaynak tablo seçilmedi)</span>}
                            </span>
                            {sourceColumns.length > 0 && (
                              <button
                                type="button"
                                onClick={handleAutoMap}
                                className="ml-3 flex-shrink-0 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-2 py-0.5 transition-colors"
                              >
                                ✦ Otomatik Eşle
                                {dstColumns && dstColumns.length > 0 && ' (hedef karşılaştır)'}
                              </button>
                            )}
                          </div>
                          {/* SQL sorgu modunda kolonları yükle */}
                          {srcQuery && srcConnId && (
                            <div className="flex items-center gap-2 pt-0.5 border-t border-border/50">
                              <span className="text-muted-foreground/70">SQL sorgu modu — kolonlar bilinmiyor.</span>
                              <button
                                type="button"
                                onClick={() => handleLoadQueryColumns(srcConnId, srcQuery)}
                                disabled={isLoadingQCols}
                                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                              >
                                {isLoadingQCols
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <RefreshCw className="h-3 w-3" />}
                                {querySrcColumns.length > 0
                                  ? `Yenile (${querySrcColumns.length} kolon)`
                                  : 'Kolonları Yükle'}
                              </button>
                              {querySrcColumns.length > 0 && (
                                <span className="text-green-500">✓ {querySrcColumns.length} kolon</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded border border-amber-800/50 bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-400 flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          Bağlı kaynak node bulunamadı — kolonlar gösterilemez.
                        </div>
                      )}

                      {/* Hedef tablo kolon yükleme durumu */}
                      {canFetchDstCols && dstColsLoading && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Hedef tablo kolonları yükleniyor...
                        </div>
                      )}

                      <ColumnMappingEditor
                        sourceColumns={sourceColumns}
                        dstColumns={dstColumns?.map((c) => ({ name: c.name, type: c.data_type })) ?? []}
                        mappings={mappings}
                        onChange={(m) => updateConfig({ column_mappings: m })}
                        isLoading={srcColsLoading}
                        onAutoMap={handleAutoMap}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════ TRANSFORM ══════════ */}
        {isTransform && (
          <div className="space-y-3">
            {/* Kaynak bilgisi */}
            {upstreamSourceNode ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Kaynak:</span>{' '}
                    {upstreamSourceNode.data.label}
                    {srcTable && <> → <span className="font-mono text-primary">{srcSchema ? `${srcSchema}.` : ''}{srcTable}</span></>}
                    {srcQuery && <> → <span className="font-mono text-primary">SQL Sorgu</span></>}
                  </span>
                  {sourceColumns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const mapped: ColumnMapping[] = sourceColumns.map((sc) => ({
                          source_column: sc.name,
                          target_column: sc.name,
                          transforms: [],
                          skip: false,
                          source_type: sc.type || undefined,
                        }))
                        updateConfig({ column_mappings: mapped })
                      }}
                      className="ml-3 flex-shrink-0 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-2 py-0.5 transition-colors"
                    >
                      ✦ Otomatik Eşle
                    </button>
                  )}
                </div>
                {/* SQL sorgu modunda kolonları yükle */}
                {srcQuery && srcConnId && (
                  <div className="flex items-center gap-2 pt-0.5 border-t border-border/50">
                    <span className="text-muted-foreground/70">SQL sorgu modu.</span>
                    <button
                      type="button"
                      onClick={() => handleLoadQueryColumns(srcConnId, srcQuery)}
                      disabled={isLoadingQCols}
                      className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {isLoadingQCols
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                      {querySrcColumns.length > 0 ? `Yenile (${querySrcColumns.length} kolon)` : 'Kolonları Yükle'}
                    </button>
                    {querySrcColumns.length > 0 && (
                      <span className="text-green-500">✓ {querySrcColumns.length} kolon</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Bu transform node'a bağlı bir kaynak (source) bulunamadı.
              </div>
            )}

            <ColumnMappingEditor
              sourceColumns={sourceColumns}
              mappings={mappings}
              onChange={(m) => updateConfig({ column_mappings: m })}
              isLoading={srcColsLoading || isLoadingQCols}
              onAutoMap={() => {
                const mapped: ColumnMapping[] = sourceColumns.map((sc) => ({
                  source_column: sc.name,
                  target_column: sc.name,
                  transforms: [],
                  skip: false,
                  source_type: sc.type || undefined,
                }))
                updateConfig({ column_mappings: mapped })
              }}
            />
          </div>
        )}

        {/* ══════════ FILTER ══════════ */}
        {localNode.type === 'filter' && (
          <div>
            <label className="block text-sm font-medium mb-1">Filtre Koşulu</label>
            <input
              type="text"
              value={(cfg.condition as string) || ''}
              onChange={(e) => updateConfig({ condition: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="column = 'deger'"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Desteklenen: =, !=, {'>'}, {'<'}, {'>='},{'<='}, LIKE (* wildcard)
            </p>
          </div>
        )}

        {/* ══════════ SQL EXECUTE ══════════ */}
        {isSqlExecute && (
          <div className="space-y-4">
            {/* Bağlantı */}
            <div>
              <label className="block text-sm font-medium mb-1">Bağlantı</label>
              <select
                value={connectionId || ''}
                onChange={(e) => {
                  const conn = connections?.find((c) => c.id === e.target.value)
                  updateConfig({
                    connection_id: e.target.value || undefined,
                    connection_type: conn?.type ?? undefined,
                  })
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Bağlantı seç —</option>
                {connections?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>

            {/* SQL Editörü */}
            <div>
              <label className="block text-sm font-medium mb-1">SQL Sorgusu</label>
              <p className="text-xs text-muted-foreground mb-2">
                INSERT, UPDATE, DELETE, TRUNCATE, CREATE, DROP vb. — SELECT dahil her SQL çalışır.
              </p>
              <SqlEditor
                value={(cfg.sql as string) || ''}
                onChange={(v) => updateConfig({ sql: v })}
                minHeight={220}
              />
            </div>

            {/* Bilgi kutusu */}
            <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Bu node, workflow çalıştırıldığında SQL sorgusunu doğrudan hedef veritabanında çalıştırır.
                Geri alınamaz işlemler (DROP, TRUNCATE) dikkatli kullanılmalıdır.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          İptal
        </button>
        <button onClick={() => onSave(localNode)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          Uygula
        </button>
      </div>
    </div>
  )
}
