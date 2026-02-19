import { api } from './client'
import type {
  Orchestration,
  OrchestrationCreate,
  OrchestrationRunResult,
  OrchestrationUpdate,
} from '@/types/orchestration'

export const orchestrationApi = {
  list: async (): Promise<Orchestration[]> => {
    const res = await api.get<Orchestration[]>('/orchestrations')
    return res.data
  },

  get: async (id: string): Promise<Orchestration> => {
    const res = await api.get<Orchestration>(`/orchestrations/${id}`)
    return res.data
  },

  create: async (data: OrchestrationCreate): Promise<Orchestration> => {
    const res = await api.post<Orchestration>('/orchestrations', data)
    return res.data
  },

  update: async (id: string, data: OrchestrationUpdate): Promise<Orchestration> => {
    const res = await api.put<Orchestration>(`/orchestrations/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/orchestrations/${id}`)
  },

  run: async (id: string): Promise<OrchestrationRunResult> => {
    const res = await api.post<OrchestrationRunResult>(`/orchestrations/${id}/run`)
    return res.data
  },

  toggle: async (id: string): Promise<Orchestration> => {
    const res = await api.post<Orchestration>(`/orchestrations/${id}/toggle`)
    return res.data
  },
}
