import type { ColumnInfo } from './connection'

export interface PreviewTableRequest {
  connection_id: string
  schema_name: string
  table_name: string
  limit?: number
}

export interface PreviewQueryRequest {
  connection_id: string
  query: string
  limit?: number
}

export interface PreviewResponse {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  total_rows: number
  truncated: boolean
}
