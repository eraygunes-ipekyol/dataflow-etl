import { api } from './client'
import type { Execution, ExecutionDetail, ExecutionLog } from '@/types/execution'

export interface ExecutionListParams {
  workflow_id?: string
  folder_id?: string   // Klasör filtresi (alt klasörler dahil)
  date_from?: string   // YYYY-MM-DD
  date_to?: string     // YYYY-MM-DD
  status?: string
  limit?: number
}

export const executionApi = {
  list: async (params?: ExecutionListParams) => {
    const res = await api.get<Execution[]>('/executions', { params })
    return res.data
  },

  get: async (id: string) => {
    const res = await api.get<ExecutionDetail>(`/executions/${id}`)
    return res.data
  },

  getLogs: async (id: string) => {
    const res = await api.get<ExecutionLog[]>(`/executions/${id}/logs`)
    return res.data
  },

  run: async (workflowId: string) => {
    const res = await api.post<Execution>(`/executions/run/${workflowId}`)
    return res.data
  },

  cancel: async (id: string) => {
    await api.post(`/executions/${id}/cancel`)
  },
}
