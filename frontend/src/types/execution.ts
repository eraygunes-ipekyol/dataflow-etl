export interface Execution {
  id: string
  workflow_id: string
  workflow_name?: string
  folder_id?: string
  folder_path?: string   // Örn: "Satış > Günlük"
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  trigger_type: 'manual' | 'scheduled' | 'chained'
  error_message?: string
  rows_processed: number
  rows_failed: number
  started_at?: string
  finished_at?: string
  created_at: string
}

export interface ExecutionLog {
  id: number
  execution_id: string
  node_id?: string
  level: 'debug' | 'info' | 'warning' | 'error'
  message: string
  created_at: string
}

export interface ExecutionDetail extends Execution {
  logs: ExecutionLog[]
}
