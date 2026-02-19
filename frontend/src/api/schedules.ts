import { api } from './client'
import type { Schedule, ScheduleCreate, ScheduleUpdate } from '@/types/schedule'

export const scheduleApi = {
  list: async (workflowId?: string) => {
    const params = workflowId ? { workflow_id: workflowId } : {}
    const res = await api.get<Schedule[]>('/schedules', { params })
    return res.data
  },

  get: async (id: string) => {
    const res = await api.get<Schedule>(`/schedules/${id}`)
    return res.data
  },

  create: async (data: ScheduleCreate) => {
    const res = await api.post<Schedule>('/schedules', data)
    return res.data
  },

  update: async (id: string, data: ScheduleUpdate) => {
    const res = await api.put<Schedule>(`/schedules/${id}`, data)
    return res.data
  },

  delete: async (id: string) => {
    await api.delete(`/schedules/${id}`)
  },
}
