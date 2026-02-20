import { useState, useMemo, useCallback } from 'react'
import {
  Database,
  HardDrive,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  Activity,
  Play,
  Calendar,
  Loader2,
  Shrink,
} from 'lucide-react'
import { fmtDateTime } from '@/utils/date'
import {
  useDbStats,
  useVacuum,
  useAdminAuditLogs,
  useDeleteAuditLogsByIds,
  useDeleteAuditLogsByDate,
  useAdminExecutionLogs,
  useDeleteExecutionLogsByIds,
  useDeleteExecutionLogsByDate,
  useAdminExecutions,
  useDeleteExecutionsByIds,
  useDeleteExecutionsByDate,
} from '@/hooks/useAdmin'
import type {
  AdminAuditLogItem,
  AdminExecutionLogItem,
  AdminExecutionItem,
} from '@/api/admin'

const PAGE_SIZE = 50

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// ─── Tarih Filtresi ──────────────────────────────────────────────────────────

interface DateFilterProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onDeleteByDate: () => void
  isDeleting: boolean
  totalSelected: number
  onDeleteSelected: () => void
  isDeletingSelected: boolean
}

function DateFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onDeleteByDate,
  isDeleting,
  totalSelected,
  onDeleteSelected,
  isDeletingSelected,
}: DateFilterProps) {
  const [showDateConfirm, setShowDateConfirm] = useState(false)
  const [showSelConfirm, setShowSelConfirm] = useState(false)

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Başlangıç</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Bitiş</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Tarihe göre sil */}
      {dateTo && (
        <div className="relative">
          {!showDateConfirm ? (
            <button
              onClick={() => setShowDateConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Tarihe göre sil
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400">{dateTo} öncesini sil?</span>
              <button
                onClick={() => {
                  onDeleteByDate()
                  setShowDateConfirm(false)
                }}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Evet'}
              </button>
              <button
                onClick={() => setShowDateConfirm(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                İptal
              </button>
            </div>
          )}
        </div>
      )}

      {/* Seçilenleri sil */}
      {totalSelected > 0 && (
        <div className="relative">
          {!showSelConfirm ? (
            <button
              onClick={() => setShowSelConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Seçilenleri sil ({totalSelected})
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400">{totalSelected} kayıt silinecek?</span>
              <button
                onClick={() => {
                  onDeleteSelected()
                  setShowSelConfirm(false)
                }}
                disabled={isDeletingSelected}
                className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isDeletingSelected ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Evet'}
              </button>
              <button
                onClick={() => setShowSelConfirm(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                İptal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pagination ──────────────────────────────────────────────────────────────

interface PaginationProps {
  total: number
  offset: number
  limit: number
  onPageChange: (offset: number) => void
}

function Pagination({ total, offset, limit, onPageChange }: PaginationProps) {
  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-1 pt-3 text-sm">
      <span className="text-muted-foreground text-xs">
        Toplam {total} kayıt — Sayfa {page}/{totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={page <= 1}
          className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(offset + limit)}
          disabled={page >= totalPages}
          className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Audit Logs Tab ──────────────────────────────────────────────────────────

function AuditLogsTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const filters = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo ? dateTo + 'T23:59:59' : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [dateFrom, dateTo, offset],
  )

  const { data, isLoading } = useAdminAuditLogs(filters)
  const deleteByIds = useDeleteAuditLogsByIds()
  const deleteByDate = useDeleteAuditLogsByDate()

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }, [items, selected.size])

  const handleDeleteSelected = () => {
    deleteByIds.mutate([...selected], { onSuccess: () => setSelected(new Set()) })
  }

  const handleDeleteByDate = () => {
    if (!dateTo) return
    deleteByDate.mutate(dateTo + 'T23:59:59')
  }

  return (
    <div>
      <DateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => { setDateFrom(v); setOffset(0) }}
        onDateToChange={(v) => { setDateTo(v); setOffset(0) }}
        onDeleteByDate={handleDeleteByDate}
        isDeleting={deleteByDate.isPending}
        totalSelected={selected.size}
        onDeleteSelected={handleDeleteSelected}
        isDeletingSelected={deleteByIds.isPending}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Kayıt bulunamadı</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                      {selected.size === items.length && items.length > 0
                        ? <CheckSquare className="h-3.5 w-3.5" />
                        : <Square className="h-3.5 w-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kullanıcı</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">İşlem</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tür</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Varlık</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: AdminAuditLogItem, i: number) => (
                  <tr key={item.id} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {selected.has(item.id)
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          : <Square className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-3 py-2 font-medium">{item.username}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{item.action}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.entity_type}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]" title={item.entity_name ?? ''}>
                      {item.entity_name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} offset={offset} limit={PAGE_SIZE} onPageChange={setOffset} />
        </>
      )}
    </div>
  )
}

// ─── Execution Logs Tab ──────────────────────────────────────────────────────

function ExecutionLogsTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const filters = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo ? dateTo + 'T23:59:59' : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [dateFrom, dateTo, offset],
  )

  const { data, isLoading } = useAdminExecutionLogs(filters)
  const deleteByIds = useDeleteExecutionLogsByIds()
  const deleteByDate = useDeleteExecutionLogsByDate()

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }, [items, selected.size])

  const handleDeleteSelected = () => {
    deleteByIds.mutate([...selected], { onSuccess: () => setSelected(new Set()) })
  }

  const handleDeleteByDate = () => {
    if (!dateTo) return
    deleteByDate.mutate(dateTo + 'T23:59:59')
  }

  const levelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'bg-red-500/10 text-red-400'
      case 'warning': return 'bg-amber-500/10 text-amber-400'
      case 'info': return 'bg-blue-500/10 text-blue-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div>
      <DateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => { setDateFrom(v); setOffset(0) }}
        onDateToChange={(v) => { setDateTo(v); setOffset(0) }}
        onDeleteByDate={handleDeleteByDate}
        isDeleting={deleteByDate.isPending}
        totalSelected={selected.size}
        onDeleteSelected={handleDeleteSelected}
        isDeletingSelected={deleteByIds.isPending}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Kayıt bulunamadı</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                      {selected.size === items.length && items.length > 0
                        ? <CheckSquare className="h-3.5 w-3.5" />
                        : <Square className="h-3.5 w-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Seviye</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Execution</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Node</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: AdminExecutionLogItem, i: number) => (
                  <tr key={item.id} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {selected.has(item.id)
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          : <Square className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${levelColor(item.level)}`}>
                        {item.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[10px] truncate max-w-[120px]" title={item.execution_id}>
                      {item.execution_id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]" title={item.node_id ?? ''}>
                      {item.node_id || '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[300px]" title={item.message}>
                      {item.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} offset={offset} limit={PAGE_SIZE} onPageChange={setOffset} />
        </>
      )}
    </div>
  )
}

// ─── Executions Tab ──────────────────────────────────────────────────────────

function ExecutionsTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filters = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo ? dateTo + 'T23:59:59' : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [dateFrom, dateTo, offset],
  )

  const { data, isLoading } = useAdminExecutions(filters)
  const deleteByIds = useDeleteExecutionsByIds()
  const deleteByDate = useDeleteExecutionsByDate()

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }, [items, selected.size])

  const handleDeleteSelected = () => {
    deleteByIds.mutate([...selected], { onSuccess: () => setSelected(new Set()) })
  }

  const handleDeleteByDate = () => {
    if (!dateTo) return
    deleteByDate.mutate(dateTo + 'T23:59:59')
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400'
      case 'failed': return 'bg-red-500/10 text-red-400'
      case 'running': return 'bg-blue-500/10 text-blue-400'
      case 'cancelled': return 'bg-amber-500/10 text-amber-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Başarılı'
      case 'failed': return 'Hatalı'
      case 'running': return 'Çalışıyor'
      case 'cancelled': return 'İptal'
      case 'pending': return 'Bekliyor'
      default: return status
    }
  }

  return (
    <div>
      <DateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => { setDateFrom(v); setOffset(0) }}
        onDateToChange={(v) => { setDateTo(v); setOffset(0) }}
        onDeleteByDate={handleDeleteByDate}
        isDeleting={deleteByDate.isPending}
        totalSelected={selected.size}
        onDeleteSelected={handleDeleteSelected}
        isDeletingSelected={deleteByIds.isPending}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Kayıt bulunamadı</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                      {selected.size === items.length && items.length > 0
                        ? <CheckSquare className="h-3.5 w-3.5" />
                        : <Square className="h-3.5 w-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Workflow</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tetikleyici</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Satır</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hata</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: AdminExecutionItem, i: number) => (
                  <tr key={item.id} className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {selected.has(item.id)
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          : <Square className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-3 py-2 font-medium truncate max-w-[180px]" title={item.workflow_name ?? item.workflow_id}>
                      {item.workflow_name || item.workflow_id.slice(0, 8) + '…'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.trigger_type}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {item.rows_processed.toLocaleString('tr-TR')}
                    </td>
                    <td className="px-3 py-2 text-red-400 truncate max-w-[200px]" title={item.error_message ?? ''}>
                      {item.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} offset={offset} limit={PAGE_SIZE} onPageChange={setOffset} />
        </>
      )}
    </div>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────

type TabKey = 'audit' | 'execLogs' | 'executions'

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: 'audit', label: 'Audit Logları', icon: FileText },
  { key: 'execLogs', label: 'Execution Logları', icon: Activity },
  { key: 'executions', label: 'Execution\'lar', icon: Play },
]

export default function DatabaseManagement() {
  const [activeTab, setActiveTab] = useState<TabKey>('audit')
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDbStats()
  const vacuum = useVacuum()

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Veritabanı Yönetimi
          </h2>
          <p className="text-sm text-muted-foreground">
            Veritabanı boyutunu izleyin, logları ve çalıştırma geçmişini yönetin
          </p>
        </div>
        <button
          onClick={() => refetchStats()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* DB Boyutu & Tablo İstatistikleri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Toplam Boyut */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">DB Boyutu</span>
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stats?.db_size_display ?? '—'}</p>
          {stats && stats.wal_file_bytes > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              DB: {formatBytes(stats.db_file_bytes)} + WAL: {formatBytes(stats.wal_file_bytes)}
            </p>
          )}
          <button
            onClick={() => vacuum.mutate()}
            disabled={vacuum.isPending}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {vacuum.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Shrink className="h-3 w-3" />
            )}
            {vacuum.isPending ? 'VACUUM çalışıyor…' : 'VACUUM — alanı geri kazan'}
          </button>
        </div>

        {/* Tablo satır sayıları */}
        {stats?.tables
          .filter((t) => ['audit_logs', 'execution_logs', 'executions'].includes(t.name))
          .map((t) => (
            <div key={t.name} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.name === 'audit_logs'
                    ? 'Audit Logları'
                    : t.name === 'execution_logs'
                      ? 'Execution Logları'
                      : "Execution'lar"}
                </span>
                {t.row_count > 10000 && (
                  <AlertTriangle className="h-4 w-4 text-amber-400" title="Yüksek kayıt sayısı" />
                )}
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {t.row_count.toLocaleString('tr-TR')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">satır</p>
            </div>
          ))}
      </div>

      {/* Tab Navigasyonu */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab İçeriği */}
      <div>
        {activeTab === 'audit' && <AuditLogsTab />}
        {activeTab === 'execLogs' && <ExecutionLogsTab />}
        {activeTab === 'executions' && <ExecutionsTab />}
      </div>
    </div>
  )
}
