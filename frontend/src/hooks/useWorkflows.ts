import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workflowApi } from '@/api/workflows'
import type { WorkflowCreate, WorkflowUpdate } from '@/types/workflow'

export function useWorkflows(folderId?: string) {
  return useQuery({
    queryKey: ['workflows', folderId],
    queryFn: () => workflowApi.list(folderId),
  })
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => workflowApi.get(id),
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: WorkflowCreate) => workflowApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Workflow oluşturuldu', {
        description: data.name,
      })
    },
    onError: (error: Error) => {
      toast.error('Workflow oluşturulamadı', {
        description: error.message,
      })
    },
  })
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkflowUpdate }) =>
      workflowApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Workflow güncellendi', {
        description: data.name,
      })
    },
    onError: (error: Error) => {
      toast.error('Workflow güncellenemedi', {
        description: error.message,
      })
    },
  })
}

export function useRenameWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workflowApi.update(id, { name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Workflow yeniden adlandırıldı', {
        description: data.name,
      })
    },
    onError: (error: Error) => {
      toast.error('Yeniden adlandırma başarısız', {
        description: error.message,
      })
    },
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => workflowApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Workflow silindi')
    },
    onError: (error: Error) => {
      toast.error('Workflow silinemedi', {
        description: error.message,
      })
    },
  })
}

export function useValidateWorkflow() {
  return useMutation({
    mutationFn: (id: string) => workflowApi.validate(id),
    onSuccess: (result) => {
      if (result.valid) {
        toast.success('Workflow geçerli', {
          description:
            result.warnings.length > 0
              ? `${result.warnings.length} uyarı var`
              : undefined,
        })
      } else {
        toast.error('Workflow geçersiz', {
          description: `${result.errors.length} hata bulundu`,
        })
      }
    },
    onError: (error: Error) => {
      toast.error('Doğrulama başarısız', {
        description: error.message,
      })
    },
  })
}

export function useExportWorkflow() {
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename?: string }) =>
      workflowApi.exportDownload(id, filename),
    onSuccess: () => {
      toast.success('Workflow dışa aktarıldı')
    },
    onError: (error: Error) => {
      toast.error('Dışa aktarma başarısız', {
        description: error.message,
      })
    },
  })
}

export function useImportWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ file, folderId }: { file: File; folderId?: string }) =>
      workflowApi.import(file, folderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Workflow içe aktarıldı', {
        description: data.name,
      })
    },
    onError: (error: Error) => {
      toast.error('İçe aktarma başarısız', {
        description: error.message,
      })
    },
  })
}
