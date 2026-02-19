import { api } from './client'
import type { AuditLog, AuditLogFilter } from '@/types/audit_log'

export const auditLogsApi = {
  list: async (filter?: AuditLogFilter): Promise<AuditLog[]> => {
    const res = await api.get<AuditLog[]>('/audit-logs', { params: filter })
    return res.data
  },

  getWorkflowHistory: async (workflowId: string): Promise<AuditLog[]> => {
    const res = await api.get<AuditLog[]>(`/audit-logs/workflows/${workflowId}/history`)
    return res.data
  },
}
