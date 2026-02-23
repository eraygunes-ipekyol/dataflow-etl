import { useState } from 'react'
import {
  Loader2,
  Sparkles,
  X,
  Replace,
  PlusCircle,
  Check,
  AlertTriangle,
  FileText,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { useAIGenerate, useAISummarize } from '@/hooks/useAI'
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@/types/workflow'
import type { AISummarizeResponse } from '@/types/ai'

interface AIAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  currentNodes: WorkflowNode[]
  currentEdges: WorkflowEdge[]
  workflowName?: string
  onApplyReplace: (definition: WorkflowDefinition) => void
  onApplyMerge: (definition: WorkflowDefinition) => void
}

export default function AIAssistantModal({
  isOpen,
  onClose,
  currentNodes,
  currentEdges,
  workflowName,
  onApplyReplace,
  onApplyMerge,
}: AIAssistantModalProps) {
  const [prompt, setPrompt] = useState('')
  const aiGenerate = useAIGenerate()
  const aiSummarize = useAISummarize()
  const [result, setResult] = useState<{
    definition: WorkflowDefinition
    explanation: string
  } | null>(null)
  const [summaryResult, setSummaryResult] = useState<AISummarizeResponse | null>(null)

  const hasExistingWorkflow = currentNodes.length > 0

  // ── Workflow Ozet ───────────────────────────────────────────────────────────

  const handleSummarize = () => {
    aiSummarize.mutate(
      {
        workflow_definition: { nodes: currentNodes, edges: currentEdges },
        workflow_name: workflowName,
      },
      {
        onSuccess: (data) => {
          setSummaryResult(data)
        },
      }
    )
  }

  // ── Workflow Olustur ────────────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!prompt.trim()) return

    const currentWorkflow =
      hasExistingWorkflow
        ? { nodes: currentNodes, edges: currentEdges }
        : null

    aiGenerate.mutate(
      {
        prompt: prompt.trim(),
        current_workflow: currentWorkflow,
        workflow_name: workflowName,
      },
      {
        onSuccess: (data) => {
          setResult({
            definition: data.workflow_definition,
            explanation: data.explanation,
          })
        },
      }
    )
  }

  const handleApplyReplace = () => {
    if (!result) return
    onApplyReplace(result.definition)
    handleReset()
    onClose()
  }

  const handleApplyMerge = () => {
    if (!result) return
    onApplyMerge(result.definition)
    handleReset()
    onClose()
  }

  const handleApply = () => {
    if (!result) return
    // Bos workflow ise direkt uygula
    onApplyReplace(result.definition)
    handleReset()
    onClose()
  }

  const handleReset = () => {
    setPrompt('')
    setResult(null)
    setSummaryResult(null)
    aiGenerate.reset()
    aiSummarize.reset()
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  if (!isOpen) return null

  const nodeCount = result?.definition.nodes.length ?? 0
  const edgeCount = result?.definition.edges.length ?? 0
  const nodeTypes = result
    ? [...new Set(result.definition.nodes.map((n) => n.type))]
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold">AI Asistan</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* ── Workflow Ozeti Bolumu ─────────────────────────────────────── */}
          {hasExistingWorkflow && (
            <div className="space-y-3">
              {/* Ozet henuz alinmadi */}
              {!summaryResult && !aiSummarize.isPending && !aiSummarize.isError && (
                <button
                  onClick={handleSummarize}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Workflow Analizi
                </button>
              )}

              {/* Ozet yukleniyor */}
              {aiSummarize.isPending && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-sm text-blue-400">Workflow analiz ediliyor...</span>
                </div>
              )}

              {/* Ozet hatasi */}
              {aiSummarize.isError && !summaryResult && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-400 font-medium">Analiz Hatasi</p>
                      <p className="text-xs text-red-400/80 mt-1">
                        {(aiSummarize.error as any)?.response?.data?.detail ||
                          'Workflow analizi yapilamadi.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      aiSummarize.reset()
                      handleSummarize()
                    }}
                    className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Tekrar dene
                  </button>
                </div>
              )}

              {/* Ozet sonucu */}
              {summaryResult && (
                <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-violet-500/10 p-4 space-y-3">
                  {/* Baslik + istatistik */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Workflow Analizi</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                        {summaryResult.node_count} node
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                        {summaryResult.edge_count} baglanti
                      </span>
                    </div>
                  </div>

                  {/* Ozet metni */}
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {summaryResult.summary}
                  </p>

                  {/* Adimlar */}
                  {summaryResult.steps.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Adimlar
                      </p>
                      <div className="space-y-1">
                        {summaryResult.steps.map((step, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-sm text-foreground/80"
                          >
                            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400/70" />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Yeniden ozet al */}
                  <button
                    onClick={() => {
                      setSummaryResult(null)
                      aiSummarize.reset()
                      handleSummarize()
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Yeniden analiz et
                  </button>
                </div>
              )}

              {/* Ayirici */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">Workflow Olustur</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>
          )}

          {/* ── Workflow Olusturma Bolumu ─────────────────────────────────── */}

          {/* Prompt Girisi */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Ne tur bir workflow olusturmak istiyorsunuz?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Orn: MSSQL'deki musteri tablosundan aktif musterileri filtreleyip BigQuery'ye aktar..."
              rows={4}
              disabled={aiGenerate.isPending}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleGenerate()
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ctrl+Enter ile gonderebilirsiniz
            </p>
          </div>

          {/* Olustur Butonu */}
          {!result && (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || aiGenerate.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {aiGenerate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI dusunuyor...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Workflow Olustur
                </>
              )}
            </button>
          )}

          {/* Hata */}
          {aiGenerate.isError && !result && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-400 font-medium">Hata Olustu</p>
                <p className="text-xs text-red-400/80 mt-1">
                  {(aiGenerate.error as any)?.response?.data?.detail ||
                    'AI ile iletisim kurulamadi. Lutfen tekrar deneyin.'}
                </p>
              </div>
            </div>
          )}

          {/* Sonuc */}
          {result && (
            <div className="space-y-4">
              {/* Aciklama */}
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-violet-400" />
                  <p className="text-sm font-medium text-violet-300">AI Yaniti</p>
                </div>
                <p className="text-sm text-foreground/80">{result.explanation}</p>
              </div>

              {/* Ozet */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                  {nodeCount} node
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  {edgeCount} baglanti
                </span>
                <span className="text-muted-foreground/60">
                  Tipler: {nodeTypes.join(', ')}
                </span>
              </div>

              {/* Uygulama Secenekleri */}
              {hasExistingWorkflow ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleApplyReplace}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                  >
                    <Replace className="h-4 w-4" />
                    Degistir
                  </button>
                  <button
                    onClick={handleApplyMerge}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Mevcut'e Ekle
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleApply}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Uygula
                </button>
              )}

              {/* Yeniden Olustur */}
              <button
                onClick={() => {
                  setResult(null)
                  aiGenerate.reset()
                }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Farkli bir sonuc olustur
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3">
          <p className="text-xs text-muted-foreground text-center">
            AI tarafindan olusturulan workflow'lari uygulamadan once kontrol etmeniz onerilir.
          </p>
        </div>
      </div>
    </div>
  )
}
