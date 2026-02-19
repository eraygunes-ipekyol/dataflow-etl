import { api as apiClient } from './client'
import type { Folder, FolderCreate, FolderUpdate, FolderTree } from '@/types/folder'

export const folderApi = {
  list: async (parentId?: string) => {
    const params = parentId !== undefined ? { parent_id: parentId } : {}
    const response = await apiClient.get<Folder[]>('/folders', { params })
    return response.data
  },

  tree: async () => {
    const response = await apiClient.get<FolderTree[]>('/folders/tree')
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Folder>(`/folders/${id}`)
    return response.data
  },

  create: async (data: FolderCreate) => {
    const response = await apiClient.post<Folder>('/folders', data)
    return response.data
  },

  update: async (id: string, data: FolderUpdate) => {
    const response = await apiClient.put<Folder>(`/folders/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    await apiClient.delete(`/folders/${id}`)
  },
}
