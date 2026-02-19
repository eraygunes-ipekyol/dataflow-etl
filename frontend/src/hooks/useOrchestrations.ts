import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { orchestrationApi } from '@/api/orchestrations'
import type { OrchestrationCreate, OrchestrationUpdate } from '@/types/orchestration'

export function useOrchestrations() {
  return useQuery({
    queryKey: ['orchestrations'],
    queryFn: () => orchestrationApi.list(),
    refetchInterval: 30_000,
  })
}

export function useOrchestration(id: string) {
  return useQuery({
    queryKey: ['orchestration', id],
    queryFn: () => orchestrationApi.get(id),
    enabled: !!id,
  })
}

export function useCreateOrchestration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: OrchestrationCreate) => orchestrationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrations'] })
      toast.success('Orkestrasyon oluşturuldu')
    },
    onError: (err: Error) => {
      toast.error('Oluşturma başarısız', { description: err.message })
    },
  })
}

export function useUpdateOrchestration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrchestrationUpdate }) =>
      orchestrationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrations'] })
      toast.success('Orkestrasyon güncellendi')
    },
    onError: (err: Error) => {
      toast.error('Güncelleme başarısız', { description: err.message })
    },
  })
}

export function useDeleteOrchestration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orchestrationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrations'] })
      toast.success('Orkestrasyon silindi')
    },
    onError: (err: Error) => {
      toast.error('Silme başarısız', { description: err.message })
    },
  })
}

export function useRunOrchestration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orchestrationApi.run(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orchestrations'] })
      queryClient.invalidateQueries({ queryKey: ['executions'] })
      if (result.status === 'success') {
        toast.success(`Orkestrasyon tamamlandı (${result.completed_steps}/${result.total_steps} adım)`)
      } else if (result.status === 'partial') {
        toast.warning(
          `Kısmen tamamlandı: ${result.completed_steps} başarılı, ${result.failed_steps} başarısız`,
        )
      } else {
        toast.error(`Orkestrasyon başarısız (${result.failed_steps} adım hata aldı)`)
      }
    },
    onError: (err: Error) => {
      toast.error('Çalıştırma başarısız', { description: err.message })
    },
  })
}

export function useToggleOrchestration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orchestrationApi.toggle(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orchestrations'] })
      toast.success(data.is_active ? 'Orkestrasyon aktif edildi' : 'Orkestrasyon pasif edildi')
    },
    onError: (err: Error) => {
      toast.error('Durum değiştirilmedi', { description: err.message })
    },
  })
}
