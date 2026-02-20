export interface Schedule {
  id: string
  workflow_id: string
  name: string
  cron_expression: string
  is_active: boolean
  last_run_at?: string
  next_run_at?: string
  created_at: string
  updated_at: string
}

export interface ScheduleCreate {
  workflow_id: string
  name: string
  cron_expression: string
  is_active?: boolean
}

export interface ScheduleUpdate {
  name?: string
  cron_expression?: string
  is_active?: boolean
}