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

export const CRON_PRESETS = [
  { label: 'Her dakika', value: '* * * * *' },
  { label: 'Her 5 dakika', value: '*/5 * * * *' },
  { label: 'Her 15 dakika', value: '*/15 * * * *' },
  { label: 'Her 30 dakika', value: '*/30 * * * *' },
  { label: 'Her saat', value: '0 * * * *' },
  { label: 'Her 6 saatte bir', value: '0 */6 * * *' },
  { label: 'Her gece yarısı', value: '0 0 * * *' },
  { label: 'Her sabah 8', value: '0 8 * * *' },
  { label: 'Her Pazartesi 9:00', value: '0 9 * * 1' },
  { label: 'Her ay 1. gün', value: '0 0 1 * *' },
]
