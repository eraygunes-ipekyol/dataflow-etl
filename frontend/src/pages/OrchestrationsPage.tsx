import { useState } from 'react'
import {
  GitMerge, Plus, Trash2, ToggleLeft, ToggleRight, Play,
  ChevronDown, ChevronUp, Edit2, X, GripVertical,
  CheckCircle2, XCircle, AlertCircle, Clock,
} from 'lucide-react'
import {
  useOrchestrations,
  useCreateOrchestration,
  useUpdateOrchestration,
  useDeleteOrchestration,
  useRunOrchestration,
  useToggleOrchestration,
} from '@/hooks/useOrchestrations'
import { useWorkflows } from '@/hooks/useWorkflows'
import { fmtDateTime } from '@/utils/date'
import { CRON_PRESETS, type Orchestration, type OrchestrationStepCreate } from '@/types/orchestration'

// ─── Boş adım şablonu ──────────────────────────────────────────────────────
const emptyStep = (): OrchestrationStepCreate => ({
  workflow_id: '',
  order_index: 0,
  retry_count: 0,
  retry_delay_seconds: 30,
  timeout_seconds: 0,
  on_failure: 'stop',
})

// ─── Boş form ──────────────────────────────────────────────────────────────
const emptyForm = () => ({
  name: '',
  description: '',
  cron_expression: '0 8 * * 1-5',
  is_active: true,
  on_error: 'stop' as 'stop' | 'continue',
  steps: [emptyStep()],
})

// ─── Durum badge ──────────────────────────────────────────────────────────
function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? 'bg-green-900/40 text-green-400 border-green-700'
          : 'bg-zinc-800 text-zinc-400 border-zinc-600'
      }`}
    >
      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {isActive ? 'Aktif' : 'Pasif'}
    </span>
  )
}

// ─── Adım editörü ─────────────────────────────────────────────────────────
interface StepEditorProps {
  steps: OrchestrationStepCreate[]
  onChange: (steps: OrchestrationStepCreate[]) => void
  workflows: { id: string; name: string }[]
}

function StepEditor({ steps, onChange, workflows }: StepEditorProps) {
  const update = (index: number, patch: Partial<OrchestrationStepCreate>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order_index: i })))
  }

  const addStep = () => {
    onChange([...steps, { ...emptyStep(), order_index: steps.length }])
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...steps]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next.map((s, i) => ({ ...s, order_index: i })))
  }

  const moveDown = (index: number) => {
    if (index === steps.length - 1) return
    const next = [...steps]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next.map((s, i) => ({ ...s, order_index: i })))
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/5 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === steps.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Adım {i + 1}
            </span>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded p-1 hover:bg-destructive/10 text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Workflow seçimi */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Workflow *</label>
              <select
                value={step.workflow_id}
                onChange={(e) => update(i, { workflow_id: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="">-- Workflow seç --</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Retry */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Tekrar Deneme
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={step.retry_count}
                onChange={(e) => update(i, { retry_count: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>

            {/* Retry delay */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Bekleme (sn)
              </label>
              <input
                type="number"
                min={0}
                max={3600}
                value={step.retry_delay_seconds}
                onChange={(e) => update(i, { retry_delay_seconds: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Zaman Aşımı (sn, 0=sınırsız)
              </label>
              <input
                type="number"
                min={0}
                value={step.timeout_seconds}
                onChange={(e) => update(i, { timeout_seconds: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>

            {/* On failure */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Hata Durumunda
              </label>
              <select
                value={step.on_failure}
                onChange={(e) => update(i, { on_failure: e.target.value as 'stop' | 'continue' })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="stop">Durdur</option>
                <option value="continue">Devam Et</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" />
        Adım Ekle
      </button>
    </div>
  )
}

// ─── Orkestrasyon form modali ──────────────────────────────────────────────
interface OrcFormProps {
  initial?: Orchestration
  workflows: { id: string; name: string }[]
  onClose: () => void
}

function OrcForm({ initial, workflows, onClose }: OrcFormProps) {
  const create = useCreateOrchestration()
  const update = useUpdateOrchestration()
  const isEdit = !!initial

  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          cron_expression: initial.cron_expression,
          is_active: initial.is_active,
          on_error: initial.on_error as 'stop' | 'continue',
          steps: initial.steps.map((s) => ({
            workflow_id: s.workflow_id,
            order_index: s.order_index,
            retry_count: s.retry_count,
            retry_delay_seconds: s.retry_delay_seconds,
            timeout_seconds: s.timeout_seconds,
            on_failure: s.on_failure as 'stop' | 'continue',
          })),
        }
      : emptyForm()
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.steps.length === 0) return
    if (form.steps.some((s) => !s.workflow_id)) return

    const payload = {
      ...form,
      steps: form.steps.map((s, i) => ({ ...s, order_index: i })),
    }

    if (isEdit) {
      await update.mutateAsync({ id: initial!.id, data: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-10 overflow-y-auto pb-10">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Orkestrasyon Düzenle' : 'Yeni Orkestrasyon'}
          </h2>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Temel bilgiler */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">İsim *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Günlük ETL Orkestrasyon"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Açıklama</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="İsteğe bağlı açıklama"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {/* Cron */}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Cron Zamanlaması *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.cron_expression}
                  onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                  required
                  placeholder="0 8 * * 1-5"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                />
                <select
                  onChange={(e) =>
                    e.target.value && setForm((f) => ({ ...f, cron_expression: e.target.value }))
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">Şablon</option>
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Format: dakika saat gün ay haftanın-günü (İstanbul saatine göre)
              </p>
            </div>

            {/* On error */}
            <div>
              <label className="block text-sm font-medium mb-1">Genel Hata Politikası</label>
              <select
                value={form.on_error}
                onChange={(e) => setForm((f) => ({ ...f, on_error: e.target.value as 'stop' | 'continue' }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="stop">Hata → Durdur</option>
                <option value="continue">Hata → Devam Et</option>
              </select>
            </div>

            {/* Is active */}
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="is_active" className="text-sm">Oluşturulunca aktif et</label>
            </div>
          </div>

          {/* Adımlar */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-primary" />
              Workflow Adımları
            </h3>
            {form.steps.length === 0 && (
              <p className="text-xs text-amber-400 mb-2">⚠ En az 1 adım gereklidir.</p>
            )}
            <StepEditor
              steps={form.steps}
              onChange={(steps) => setForm((f) => ({ ...f, steps }))}
              workflows={workflows}
            />
          </div>

          {/* Butonlar */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isPending || form.steps.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Orkestrasyon satırı ──────────────────────────────────────────────────
interface OrcRowProps {
  orch: Orchestration
  workflows: { id: string; name: string }[]
  onEdit: (o: Orchestration) => void
}

function OrcRow({ orch, workflows, onEdit }: OrcRowProps) {
  const [expanded, setExpanded] = useState(false)
  const del = useDeleteOrchestration()
  const run = useRunOrchestration()
  const toggle = useToggleOrchestration()

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
        {/* İsim */}
        <td className="px-4 py-3">
          <p className="font-medium">{orch.name}</p>
          {orch.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{orch.description}</p>
          )}
        </td>

        {/* Cron */}
        <td className="px-4 py-3">
          <span className="font-mono text-xs bg-muted/20 px-2 py-0.5 rounded">{orch.cron_expression}</span>
        </td>

        {/* Adım sayısı */}
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <GitMerge className="h-3.5 w-3.5" />
            {orch.steps.length} adım
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>

        {/* Son / Sonraki çalışma */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
          <div>{orch.last_run_at ? fmtDateTime(orch.last_run_at) : '—'}</div>
          {orch.next_run_at && orch.is_active && (
            <div className="text-blue-400 mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtDateTime(orch.next_run_at)}
            </div>
          )}
        </td>

        {/* Durum */}
        <td className="px-4 py-3">
          <StatusBadge isActive={orch.is_active} />
        </td>

        {/* İşlemler */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {/* Çalıştır */}
            <button
              onClick={() => run.mutate(orch.id)}
              disabled={run.isPending}
              title="Şimdi Çalıştır"
              className="rounded p-1.5 hover:bg-green-900/20 text-green-500 transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
            </button>
            {/* Düzenle */}
            <button
              onClick={() => onEdit(orch)}
              title="Düzenle"
              className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {/* Toggle */}
            <button
              onClick={() => toggle.mutate(orch.id)}
              title={orch.is_active ? 'Pasif Et' : 'Aktif Et'}
              className={`rounded p-1.5 transition-colors ${
                orch.is_active
                  ? 'hover:bg-yellow-900/20 text-yellow-500'
                  : 'hover:bg-green-900/20 text-green-500'
              }`}
            >
              {orch.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </button>
            {/* Sil */}
            <button
              onClick={() => {
                if (window.confirm(`"${orch.name}" orkestrasyon silinecek. Emin misiniz?`)) {
                  del.mutate(orch.id)
                }
              }}
              title="Sil"
              className="rounded p-1.5 hover:bg-destructive/10 text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Adım detayları */}
      {expanded && (
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={6} className="px-6 py-3">
            <div className="space-y-2">
              {orch.steps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Adım yok</p>
              ) : (
                orch.steps.map((step, i) => {
                  const wf = workflows.find((w) => w.id === step.workflow_id)
                  return (
                    <div key={step.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded w-14 text-center flex-shrink-0">
                        Adım {i + 1}
                      </span>
                      <span className="font-medium flex-1 truncate">
                        {step.workflow_name ?? wf?.name ?? step.workflow_id.slice(0, 8)}
                      </span>
                      {step.retry_count > 0 && (
                        <span className="text-xs text-amber-400 flex-shrink-0">
                          ↺ {step.retry_count}x ({step.retry_delay_seconds}s bekle)
                        </span>
                      )}
                      {step.timeout_seconds > 0 && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ⏱ {step.timeout_seconds}s
                        </span>
                      )}
                      <span
                        className={`text-xs flex-shrink-0 ${
                          step.on_failure === 'continue' ? 'text-blue-400' : 'text-red-400'
                        }`}
                      >
                        {step.on_failure === 'continue' ? '→ Devam et' : '⛔ Durdur'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────
export default function OrchestrationsPage() {
  const { data: orchestrations = [], isLoading } = useOrchestrations()
  const { data: workflows = [] } = useWorkflows()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Orchestration | null>(null)

  const activeCount  = orchestrations.filter((o) => o.is_active).length
  const totalSteps   = orchestrations.reduce((s, o) => s + o.steps.length, 0)

  const handleEdit = (o: Orchestration) => {
    setEditTarget(o)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditTarget(null)
  }

  return (
    <div className="space-y-5 p-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orkestrasyonlar</h1>
          <p className="text-muted-foreground mt-1">
            Birden fazla workflow'u sırayla ve otomatik çalıştırın
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Orkestrasyon
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam',     val: orchestrations.length, color: 'text-foreground' },
          { label: 'Aktif',      val: activeCount,            color: 'text-green-400' },
          { label: 'Adım (∑)',   val: totalSteps,             color: 'text-blue-400' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : orchestrations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <GitMerge className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Orkestrasyon bulunamadı</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Birden fazla workflow'u zincirleme çalıştırmak için orkestrasyon oluşturun.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            İlk Orkestrasyon
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {[
                  'İsim', 'Cron', 'Adımlar', 'Son/Sonraki Çalışma', 'Durum', 'İşlem',
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                      i === 5 ? 'text-right' : i === 2 ? 'text-center' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orchestrations.map((o) => (
                <OrcRow
                  key={o.id}
                  orch={o}
                  workflows={workflows}
                  onEdit={handleEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modali */}
      {showForm && (
        <OrcForm
          initial={editTarget ?? undefined}
          workflows={workflows}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
