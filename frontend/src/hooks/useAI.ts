import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiApi } from '@/api/ai'
import type { AISettingsUpdate, AIGenerateRequest, AITestRequest, AISummarizeRequest } from '@/types/ai'

// ── AI Ayarlari (superadmin) ─────────────────────────────────────────────────

export function useAISettings() {
  return useQuery({
    queryKey: ['ai-settings'],
    queryFn: aiApi.getSettings,
    retry: false,
  })
}

export function useUpdateAISettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AISettingsUpdate) => aiApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-settings'] })
      qc.invalidateQueries({ queryKey: ['ai-status'] })
      toast.success('AI ayarları kaydedildi')
    },
    onError: () => {
      toast.error('AI ayarları kaydedilemedi')
    },
  })
}

// ── AI Durum (herkes) ────────────────────────────────────────────────────────

export function useAIStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: aiApi.getStatus,
    staleTime: 60_000,
    retry: false,
  })
}

// ── AI Saglayicilar (herkes) ─────────────────────────────────────────────────

export function useAIProviders() {
  return useQuery({
    queryKey: ['ai-providers'],
    queryFn: aiApi.getProviders,
    staleTime: 300_000,
  })
}

// ── AI Test (superadmin) ─────────────────────────────────────────────────────

export function useAITest() {
  return useMutation({
    mutationFn: (data: AITestRequest) => aiApi.testConnection(data),
  })
}

// ── AI Workflow Uretimi (herkes) ─────────────────────────────────────────────

export function useAIGenerate() {
  return useMutation({
    mutationFn: (data: AIGenerateRequest) => aiApi.generate(data),
    onError: (error: any) => {
      const detail =
        error?.response?.data?.detail || 'AI ile workflow oluşturulamadı'
      toast.error(detail)
    },
  })
}

// ── AI Workflow Ozeti (herkes) ───────────────────────────────────────────

export function useAISummarize() {
  return useMutation({
    mutationFn: (data: AISummarizeRequest) => aiApi.summarize(data),
    onError: (error: any) => {
      const detail =
        error?.response?.data?.detail || 'Workflow özeti alınamadı'
      toast.error(detail)
    },
  })
}
