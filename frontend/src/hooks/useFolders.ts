import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { folderApi } from '@/api/folders'
import type { FolderCreate, FolderUpdate } from '@/types/folder'

export function useFolders(parentId?: string) {
  return useQuery({
    queryKey: ['folders', parentId],
    queryFn: () => folderApi.list(parentId),
  })
}

export function useFolderTree() {
  return useQuery({
    queryKey: ['folders', 'tree'],
    queryFn: () => folderApi.tree(),
  })
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: ['folders', id],
    queryFn: () => folderApi.get(id),
    enabled: !!id,
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: FolderCreate) => folderApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Klasör oluşturuldu', {
        description: data.name,
      })
    },
    onError: (error: Error) => {
      toast.error('Klasör oluşturulamadı', {
        description: error.message,
      })
    },
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FolderUpdate }) =>
      folderApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Klasör güncellendi', {
        description: data.name,
      })
    },
    onError: (error: Error) => {
      toast.error('Klasör güncellenemedi', {
        description: error.message,
      })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => folderApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Klasör silindi')
    },
    onError: (error: Error) => {
      toast.error('Klasör silinemedi', {
        description: error.message,
      })
    },
  })
}
