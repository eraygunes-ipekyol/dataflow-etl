export interface OrchestrationStep {
  id: string
  orchestration_id: string
  workflow_id: string
  workflow_name?: string
  order_index: number
  retry_count: number
  retry_delay_seconds: number
  timeout_seconds: number
  on_failure: 'stop' | 'continue'
}

export interface Orchestration {
  id: string
  name: string
  description?: string
  cron_expression: string
  is_active: boolean
  on_error: 'stop' | 'continue'
  last_run_at?: string
  next_run_at?: string
  created_at: string
  updated_at: string
  steps: OrchestrationStep[]
}

export interface OrchestrationStepCreate {
  workflow_id: string
  order_index: number
  retry_count: number
  retry_delay_seconds: number
  timeout_seconds: number
  on_failure: 'stop' | 'continue'
}

export interface OrchestrationCreate {
  name: string
  description?: string
  cron_expression: string
  is_active: boolean
  on_error: 'stop' | 'continue'
  steps: OrchestrationStepCreate[]
}

export interface OrchestrationUpdate {
  name?: string
  description?: string
  cron_expression?: string
  is_active?: boolean
  on_error?: 'stop' | 'continue'
  steps?: OrchestrationStepCreate[]
}

export interface OrchestrationRunResult {
  orchestration_id: string
  orchestration_name: string
  total_steps: number
  completed_steps: number
  failed_steps: number
  skipped_steps: number
  execution_ids: string[]
  status: 'success' | 'partial' | 'failed'
}