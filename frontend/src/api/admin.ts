import { api } from './client'

// ---- Tipler ----

export interface TableInfo {
  name: string
  row_count: number
}

export interface DbStats {
  db_size_bytes: number
  db_size_display: string
  db_file_bytes: number
  wal_file_bytes: number
  tables: TableInfo[]
  total_rows: number
}

export interface BulkDeleteResult {
  deleted_count: number
  message: string
}

export interface AdminAuditLogItem {
  id: number
  username: string
  action: string
  entity_type: string
  entity_id?: string | null
  entity_name?: string | null
  ip_address?: string | null
  created_at: string
}

export interface AdminExecutionLogItem {
  id: number
  execution_id: string
  node_id?: string | null
  level: string
  message: string
  created_at: string
}

export interface AdminExecutionItem {
  id: string
  workflow_id: string
  workflow_name?: string | null
  status: string
  trigger_type: string
  error_message?: string | null
  rows_processed: number
  rows_failed: number
  started_at?: string | null
  finished_at?: string | null
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface ListFilters {
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export interface AuditLogFilters extends ListFilters {
  entity_type?: string
  action?: string
}

export interface ExecutionLogFilters extends ListFilters {
  level?: string
  execution_id?: string
}

export interface ExecutionFilters extends ListFilters {
  status?: string
}

// ---- API fonksiyonlari ----

export const adminApi = {
  /** DB boyutu ve tablo istatistikleri */
  getDbStats: async (): Promise<DbStats> => {
    const { data } = await api.get('/admin/db-stats')
    return data
  },

  /** SQLite VACUUM — DB dosyasini kucultur */
  vacuum: async (): Promise<BulkDeleteResult> => {
    const { data } = await api.post('/admin/vacuum')
    return data
  },

  // ---- Audit Logs ----

  listAuditLogs: async (filters: AuditLogFilters = {}): Promise<PaginatedResponse<AdminAuditLogItem>> => {
    const params = new URLSearchParams()
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.entity_type) params.set('entity_type', filters.entity_type)
    if (filters.action) params.set('action', filters.action)
    params.set('limit', String(filters.limit ?? 50))
    params.set('offset', String(filters.offset ?? 0))
    const { data } = await api.get(`/admin/audit-logs?${params.toString()}`)
    return data
  },

  deleteAuditLogsByIds: async (ids: number[]): Promise<BulkDeleteResult> => {
    const { data } = await api.delete('/admin/audit-logs/by-ids', { data: { ids } })
    return data
  },

  deleteAuditLogsByDate: async (dateBefore: string): Promise<BulkDeleteResult> => {
    const { data } = await api.delete('/admin/audit-logs/by-date', { data: { date_before: dateBefore } })
    return data
  },

  // ---- Execution Logs ----

  listExecutionLogs: async (filters: ExecutionLogFilters = {}): Promise<PaginatedResponse<AdminExecutionLogItem>> => {
    const params = new URLSearchParams()
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.level) params.set('level', filters.level)
    if (filters.execution_id) params.set('execution_id', filters.execution_id)
    params.set('limit', String(filters.limit ?? 50))
    params.set('offset', String(filters.offset ?? 0))
    const { data } = await api.get(`/admin/execution-logs?${params.toString()}`)
    return data
  },

  deleteExecutionLogsByIds: async (ids: number[]): Promise<BulkDeleteResult> => {
    const { data } = await api.delete('/admin/execution-logs/by-ids', { data: { ids } })
    return data
  },

  deleteExecutionLogsByDate: async (dateBefore: string): Promise<BulkDeleteResult> => {
    const { data } = await api.delete('/admin/execution-logs/by-date', { data: { date_before: dateBefore } })
    return data
  },

  // ---- Executions ----

  listExecutions: async (filters: ExecutionFilters = {}): Promise<PaginatedResponse<AdminExecutionItem>> => {
    const params = new URLSearchParams()
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.status) params.set('status', filters.status)
    params.set('limit', String(filters.limit ?? 50))
    params.set('offset', String(filters.offset ?? 0))
    const { data } = await api.get(`/admin/executions?${params.toString()}`)
    return data
  },

  deleteExecutionsByIds: async (ids: string[]): Promise<BulkDeleteResult> => {
    const { data } = await api.delete('/admin/executions/by-ids', { data: { ids } })
    return data
  },

  deleteExecutionsByDate: async (dateBefore: string): Promise<BulkDeleteResult> => {
    const { data } = await api.delete('/admin/executions/by-date', { data: { date_before: dateBefore } })
    return data
  },
}
