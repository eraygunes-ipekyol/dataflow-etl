import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { scheduleApi } from '@/api/schedules'
import type { ScheduleCreate, ScheduleUpdate } from '@/types/schedule'

export function useSchedules(workflowId?: string) {
  return useQuery({
    queryKey: ['schedules', workflowId],
    queryFn: () => scheduleApi.list(workflowId),
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ScheduleCreate) => scheduleApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Zamanlayıcı oluşturuldu', { description: data.name })
    },
    onError: (error: Error) => {
      toast.error('Zamanlayıcı oluşturulamadı', { description: error.message })
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleUpdate }) =>
      scheduleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Zamanlayıcı güncellendi')
    },
    onError: (error: Error) => {
      toast.error('Güncelleme başarısız', { description: error.message })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Zamanlayıcı silindi')
    },
    onError: (error: Error) => {
      toast.error('Silme başarısız', { description: error.message })
    },
  })
}
