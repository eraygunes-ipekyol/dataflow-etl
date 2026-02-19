import { useQuery } from '@tanstack/react-query'
import { auditLogsApi } from '@/api/audit_logs'
import type { AuditLogFilter } from '@/types/audit_log'

export function useAuditLogs(filter?: AuditLogFilter) {
  return useQuery({
    queryKey: ['audit-logs', filter],
    queryFn: () => auditLogsApi.list(filter),
    staleTime: 10 * 1000,
  })
}

export function useWorkflowHistory(workflowId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-history', workflowId],
    queryFn: () => auditLogsApi.getWorkflowHistory(workflowId!),
    enabled: !!workflowId,
    staleTime: 5 * 1000,
  })
}
