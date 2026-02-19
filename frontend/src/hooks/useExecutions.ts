import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { executionApi, type ExecutionListParams } from '@/api/executions'

export function useExecutions(params?: ExecutionListParams) {
  return useQuery({
    queryKey: ['executions', params],
    queryFn: () => executionApi.list(params),
    refetchInterval: (query) => {
      const hasRunning = query.state.data?.some(
        (e) => e.status === 'running' || e.status === 'pending'
      )
      return hasRunning ? 2000 : false
    },
  })
}

export function useExecution(id: string) {
  return useQuery({
    queryKey: ['execution', id],
    queryFn: () => executionApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'pending' ? 2000 : false
    },
  })
}

export function useRunWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workflowId: string) => executionApi.run(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] })
      toast.success('Workflow başlatıldı')
    },
    onError: (error: Error) => {
      toast.error('Workflow başlatılamadı', { description: error.message })
    },
  })
}

export function useCancelExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => executionApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] })
      toast.success('Execution iptal edildi')
    },
    onError: (error: Error) => {
      toast.error('İptal başarısız', { description: error.message })
    },
  })
}
