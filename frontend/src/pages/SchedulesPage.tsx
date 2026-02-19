import { useState } from 'react'
import { Clock, History, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSchedules, useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from '@/hooks/useSchedules'
import { useWorkflows } from '@/hooks/useWorkflows'
import { CRON_PRESETS } from '@/types/schedule'
import AuditLogModal from '@/components/ui/AuditLogModal'
import { fmtDateTime } from '@/utils/date'

export default function SchedulesPage() {
  const { data: schedules = [] } = useSchedules()
  const { data: workflows = [] } = useWorkflows()
  const createSchedule = useCreateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const updateSchedule = useUpdateSchedule()

  const [showForm, setShowForm] = useState(false)
  const [auditTarget, setAuditTarget] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    workflow_id: '',
    name: '',
    cron_expression: '0 * * * *',
    is_active: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createSchedule.mutateAsync(form)
    setShowForm(false)
    setForm({ workflow_id: '', name: '', cron_expression: '0 * * * *', is_active: true })
  }

  const toggleActive = (id: string, current: boolean) => {
    updateSchedule.mutate({ id, data: { is_active: !current } })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Zamanlamalar</h1>
          <p className="text-muted-foreground mt-1">Periyodik workflow çalıştırma zamanlamaları</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Zamanlama
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Yeni Zamanlama</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Workflow *</label>
                <select
                  value={form.workflow_id}
                  onChange={(e) => setForm((f) => ({ ...f, workflow_id: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">-- Workflow seç --</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">İsim *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Zamanlama adı"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cron İfadesi *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.cron_expression}
                  onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                  required
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                  placeholder="0 * * * *"
                />
                <select
                  onChange={(e) => e.target.value && setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">Şablon seç</option>
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Format: dakika saat gün ay haftanın-günü (örn: 0 8 * * 1-5 = Haftaiçi sabah 8)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={createSchedule.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Oluştur
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Zamanlama bulunamadı</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Bir workflow için periyodik zamanlama ekleyerek otomatik çalıştırma kurabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-3 text-left font-medium">İsim</th>
                <th className="px-4 py-3 text-left font-medium">Workflow</th>
                <th className="px-4 py-3 text-left font-medium">Cron</th>
                <th className="px-4 py-3 text-left font-medium">Sonraki Çalışma</th>
                <th className="px-4 py-3 text-left font-medium">Durum</th>
                <th className="px-4 py-3 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => {
                const wf = workflows.find((w) => w.id === schedule.workflow_id)
                return (
                  <tr key={schedule.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-3 font-medium">{schedule.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{wf?.name ?? schedule.workflow_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-xs bg-muted/10 rounded">{schedule.cron_expression}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {fmtDateTime(schedule.next_run_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(schedule.id, schedule.is_active)}
                        className="flex items-center gap-1 text-xs"
                      >
                        {schedule.is_active ? (
                          <ToggleRight className="h-5 w-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        {schedule.is_active ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAuditTarget({ id: schedule.id, name: schedule.name })}
                          title="Geçmiş"
                          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteSchedule.mutate(schedule.id)}
                          className="rounded p-1 hover:bg-destructive/10 text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit log modal */}
      {auditTarget && (
        <AuditLogModal
          title={auditTarget.name}
          filter={{ entity_type: 'schedule', entity_id: auditTarget.id, limit: 50 }}
          onClose={() => setAuditTarget(null)}
        />
      )}
    </div>
  )
}
