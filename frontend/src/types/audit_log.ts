export interface AuditLog {
  id: number
  user_id?: string | null
  username: string
  action: 'create' | 'update' | 'delete' | 'restore' | 'login'
  entity_type: 'workflow' | 'schedule' | 'orchestration' | 'connection' | 'folder' | 'user'
  entity_id?: string | null
  entity_name?: string | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  ip_address?: string | null
  created_at: string
}

export interface AuditLogFilter {
  entity_type?: string
  entity_id?: string
  user_id?: string
  limit?: number
  offset?: number
}
