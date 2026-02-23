import type { WorkflowDefinition } from './workflow'

// ── AI Ayarlari ──────────────────────────────────────────────────────────────

export interface AISettingsResponse {
  provider: string
  model: string
  api_key_set: boolean
  is_enabled: boolean
}

export interface AISettingsUpdate {
  provider: string
  model: string
  api_key?: string
  is_enabled: boolean
}

// ── AI Durum ─────────────────────────────────────────────────────────────────

export interface AIStatusResponse {
  is_enabled: boolean
  provider?: string
  model?: string
}

// ── AI Saglayicilar ──────────────────────────────────────────────────────────

export interface AIProviderInfo {
  id: string
  label: string
  models: string[]
  custom_model: boolean
}

// ── AI Workflow Uretimi ──────────────────────────────────────────────────────

export interface AIGenerateRequest {
  prompt: string
  current_workflow?: WorkflowDefinition | null
  workflow_name?: string
}

export interface AIGenerateResponse {
  workflow_definition: WorkflowDefinition
  explanation: string
}

// ── AI Test ─────────────────────────────────────────────────────────────────

export interface AITestRequest {
  provider: string
  model: string
  api_key: string
}

export interface AITestResponse {
  success: boolean
  message: string
}

// ── AI Workflow Ozeti ────────────────────────────────────────────────────────

export interface AISummarizeRequest {
  workflow_definition: WorkflowDefinition
  workflow_name?: string
}

export interface AISummarizeResponse {
  summary: string
  steps: string[]
  node_count: number
  edge_count: number
}
