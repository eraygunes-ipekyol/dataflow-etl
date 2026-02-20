export interface WorkflowDefinition {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: {
    x: number
    y: number
    zoom: number
  }
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: {
    x: number
    y: number
  }
  data: NodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: 'success' | 'failure'
  label?: string
}

export type NodeType =
  | 'source'
  | 'destination'
  | 'transform'
  | 'filter'
  | 'join'
  | 'workflow_ref'

// --- Column Mapping & Transform types ---

export type TransformType = 'rename' | 'cast' | 'default' | 'expression' | 'drop'

export type DataType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'

export interface ColumnTransform {
  type: TransformType
  target_name?: string   // rename
  cast_to?: DataType     // cast
  default_value?: string // default
  expression?: string    // expression (SQL-style)
}

export interface ColumnMapping {
  source_column: string
  target_column: string
  transforms?: ColumnTransform[]
  skip?: boolean
  source_type?: string   // kaynak kolon veri tipi (badge gösterimi için, opsiyonel)
  target_type?: string   // hedef kolon veri tipi (badge gösterimi için, opsiyonel)
}

export interface SourceNodeConfig {
  connection_id: string
  schema?: string
  table?: string
  query?: string       // custom SQL - overrides table
  chunk_size?: number
}

export interface DestinationNodeConfig {
  connection_id: string
  schema?: string
  table: string
  write_mode: 'append' | 'overwrite' | 'upsert'
  upsert_keys?: string[]
  column_mappings?: ColumnMapping[]
  // Performans & hata yönetimi
  batch_size?: number          // multi-row INSERT içindeki satır sayısı (varsayılan 500)
  on_error?: 'rollback' | 'continue'  // chunk hata → rollback(tümünü geri al) | continue(atla devam et)
}

export interface TransformNodeConfig {
  column_mappings: ColumnMapping[]
}

export interface FilterNodeConfig {
  condition: string  // SQL WHERE clause style
}

export interface NodeData {
  label: string
  description?: string
  config?: SourceNodeConfig | DestinationNodeConfig | TransformNodeConfig | FilterNodeConfig | Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  description?: string
  folder_id?: string
  definition: WorkflowDefinition
  version: number
  is_active: boolean
  notification_webhook_url?: string | null
  notification_on_failure?: boolean
  notification_on_success?: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowCreate {
  name: string
  description?: string
  folder_id?: string
  definition?: WorkflowDefinition
}

export interface WorkflowUpdate {
  name?: string
  description?: string
  folder_id?: string | null
  definition?: WorkflowDefinition
  is_active?: boolean
  notification_webhook_url?: string | null
  notification_on_failure?: boolean
  notification_on_success?: boolean
}

export interface WorkflowValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface WorkflowExport {
  name: string
  description?: string
  definition: WorkflowDefinition
  version: number
  exported_at: string
}
