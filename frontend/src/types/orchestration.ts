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

export const CRON_PRESETS = [
  { label: 'Her dakika', value: '* * * * *' },
  { label: 'Her 5 dakika', value: '*/5 * * * *' },
  { label: 'Her 15 dakika', value: '*/15 * * * *' },
  { label: 'Her 30 dakika', value: '*/30 * * * *' },
  { label: 'Her saat başı', value: '0 * * * *' },
  { label: 'Her 6 saatte bir', value: '0 */6 * * *' },
  { label: 'Her gün sabah 6', value: '0 6 * * *' },
  { label: 'Her gün öğlen 12', value: '0 12 * * *' },
  { label: 'Her gün gece yarısı', value: '0 0 * * *' },
  { label: 'Haftaiçi sabah 8', value: '0 8 * * 1-5' },
  { label: 'Her Pazartesi', value: '0 9 * * 1' },
  { label: 'Her Pazar', value: '0 0 * * 0' },
]
