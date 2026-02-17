export type ConnectionType = 'mssql' | 'bigquery'

export interface MssqlConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  driver: string
  trust_server_certificate: boolean
  encrypt: boolean
}

export interface BigQueryConfig {
  project_id: string
  dataset: string
  credentials_json: string
}

export type ConnectionConfig = MssqlConfig | BigQueryConfig

export interface Connection {
  id: string
  name: string
  type: ConnectionType
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ConnectionDetail extends Connection {
  config: Record<string, unknown>
}

export interface ConnectionCreate {
  name: string
  type: ConnectionType
  config: ConnectionConfig
}

export interface ConnectionUpdate {
  name?: string
  config?: ConnectionConfig
  is_active?: boolean
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

export interface SchemaInfo {
  name: string
}

export interface TableInfo {
  name: string
  schema_name: string
  row_count: number | null
}

export interface ColumnInfo {
  name: string
  data_type: string
  nullable: boolean
  max_length: number | null
  is_primary_key: boolean
}
