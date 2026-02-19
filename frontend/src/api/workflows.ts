import { api as apiClient } from './client'
import type {
  Workflow,
  WorkflowCreate,
  WorkflowUpdate,
  WorkflowValidationResult,
  WorkflowExport,
} from '@/types/workflow'

export const workflowApi = {
  list: async (folderId?: string) => {
    const params = folderId ? { folder_id: folderId } : {}
    const response = await apiClient.get<Workflow[]>('/workflows', { params })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Workflow>(`/workflows/${id}`)
    return response.data
  },

  create: async (data: WorkflowCreate) => {
    const response = await apiClient.post<Workflow>('/workflows', data)
    return response.data
  },

  update: async (id: string, data: WorkflowUpdate) => {
    const response = await apiClient.put<Workflow>(`/workflows/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    await apiClient.delete(`/workflows/${id}`)
  },

  validate: async (id: string) => {
    const response = await apiClient.post<WorkflowValidationResult>(
      `/workflows/${id}/validate`
    )
    return response.data
  },

  export: async (id: string) => {
    const response = await apiClient.get<WorkflowExport>(`/workflows/${id}/export`)
    return response.data
  },

  exportDownload: async (id: string, filename?: string) => {
    const data = await workflowApi.export(id)
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `${data.name}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  import: async (file: File, folderId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (folderId) {
      formData.append('folder_id', folderId)
    }
    const response = await apiClient.post<Workflow>('/workflows/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}
