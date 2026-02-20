import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  adminApi,
  type AuditLogFilters,
  type ExecutionLogFilters,
  type ExecutionFilters,
} from '@/api/admin'

const KEYS = {
  dbStats: ['admin', 'db-stats'] as const,
  auditLogs: (f: AuditLogFilters) => ['admin', 'audit-logs', f] as const,
  executionLogs: (f: ExecutionLogFilters) => ['admin', 'execution-logs', f] as const,
  executions: (f: ExecutionFilters) => ['admin', 'executions', f] as const,
}

// ---- DB Stats ----

export function useDbStats() {
  return useQuery({
    queryKey: KEYS.dbStats,
    queryFn: () => adminApi.getDbStats(),
  })
}

export function useVacuum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.vacuum(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: KEYS.dbStats })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('VACUUM işlemi başarısız oldu')
    },
  })
}

// ---- Audit Logs ----

export function useAdminAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: KEYS.auditLogs(filters),
    queryFn: () => adminApi.listAuditLogs(filters),
    placeholderData: (prev) => prev,
  })
}

export function useDeleteAuditLogsByIds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => adminApi.deleteAuditLogsByIds(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('Audit log silme başarısız')
    },
  })
}

export function useDeleteAuditLogsByDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dateBefore: string) => adminApi.deleteAuditLogsByDate(dateBefore),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('Audit log silme başarısız')
    },
  })
}

// ---- Execution Logs ----

export function useAdminExecutionLogs(filters: ExecutionLogFilters) {
  return useQuery({
    queryKey: KEYS.executionLogs(filters),
    queryFn: () => adminApi.listExecutionLogs(filters),
    placeholderData: (prev) => prev,
  })
}

export function useDeleteExecutionLogsByIds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => adminApi.deleteExecutionLogsByIds(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('Execution log silme başarısız')
    },
  })
}

export function useDeleteExecutionLogsByDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dateBefore: string) => adminApi.deleteExecutionLogsByDate(dateBefore),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('Execution log silme başarısız')
    },
  })
}

// ---- Executions ----

export function useAdminExecutions(filters: ExecutionFilters) {
  return useQuery({
    queryKey: KEYS.executions(filters),
    queryFn: () => adminApi.listExecutions(filters),
    placeholderData: (prev) => prev,
  })
}

export function useDeleteExecutionsByIds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => adminApi.deleteExecutionsByIds(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('Execution silme başarısız')
    },
  })
}

export function useDeleteExecutionsByDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dateBefore: string) => adminApi.deleteExecutionsByDate(dateBefore),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.message)
    },
    onError: () => {
      toast.error('Execution silme başarısız')
    },
  })
}
