import { api } from './client'
import type {
  AISettingsResponse,
  AISettingsUpdate,
  AIStatusResponse,
  AIProviderInfo,
  AIGenerateRequest,
  AIGenerateResponse,
  AITestRequest,
  AITestResponse,
  AISummarizeRequest,
  AISummarizeResponse,
} from '@/types/ai'

export const aiApi = {
  // ── Ayarlar (superadmin) ────────────────────────────────────────────────
  getSettings: () =>
    api.get<AISettingsResponse>('/ai/settings').then((r) => r.data),

  updateSettings: (data: AISettingsUpdate) =>
    api.put<AISettingsResponse>('/ai/settings', data).then((r) => r.data),

  // ── Durum (herkes) ──────────────────────────────────────────────────────
  getStatus: () =>
    api.get<AIStatusResponse>('/ai/status').then((r) => r.data),

  // ── Saglayicilar (herkes) ───────────────────────────────────────────────
  getProviders: () =>
    api.get<AIProviderInfo[]>('/ai/providers').then((r) => r.data),

  // ── Test (superadmin) ─────────────────────────────────────────────────
  testConnection: (data: AITestRequest) =>
    api.post<AITestResponse>('/ai/test', data).then((r) => r.data),

  // ── Workflow Uretimi (herkes) ───────────────────────────────────────────
  generate: (data: AIGenerateRequest) =>
    api.post<AIGenerateResponse>('/ai/generate', data).then((r) => r.data),

  // ── Workflow Ozeti (herkes) ────────────────────────────────────────────
  summarize: (data: AISummarizeRequest) =>
    api.post<AISummarizeResponse>('/ai/summarize', data).then((r) => r.data),
}
