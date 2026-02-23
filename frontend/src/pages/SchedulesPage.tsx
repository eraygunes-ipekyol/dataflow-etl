import { useState, useEffect } from 'react'
import { Clock, Edit2, History, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSchedules, useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from '@/hooks/useSchedules'
import { useWorkflows } from '@/hooks/useWorkflows'
import CronBuilder from '@/components/shared/CronBuilder'
import AuditLogModal from '@/components/ui/AuditLogModal'
import { fmtDateTime } from '@/utils/date'
import type { Schedule } from '@/types/schedule'

const emptyForm = () => ({
  workflow_id: '',
  name: '',
  cron_expression: '0 * * * *',
  is_active: true,
})

export default function SchedulesPage() {
  const { data: schedules = [] } = useSchedules()
  const { data: workflows = [] } = useWorkflows()
  const createSchedule = useCreateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const updateSchedule = useUpdateSchedule()

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Schedule | null>(null)
  const [auditTarget, setAuditTarget] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState(emptyForm())

  const isEdit = !!editTarget

  // editTarget degisince formu doldur
  useEffect(() => {
    if (editTarget) {
      setForm({
        workflow_id: editTarget.workflow_id,
        name: editTarget.name,
        cron_expression: editTarget.cron_expression,
        is_active: editTarget.is_active,
      })
    }
  }, [editTarget])

  const handleEdit = (schedule: Schedule) => {
    setEditTarget(schedule)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditTarget(null)
    setForm(emptyForm())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      await updateSchedule.mutateAsync({
        id: editTarget!.id,
        data: {
          name: form.name,
          cron_expression: form.cron_expression,
          is_active: form.is_active,
        },
      })
    } else {
      await createSchedule.mutateAsync(form)
    }
    handleClose()
  }

  const toggleActive = (id: string, current: boolean) => {
    updateSchedule.mutate({ id, data: { is_active: !current } })
  }

  const isPending = createSchedule.isPending || updateSchedule.isPending

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Zamanlamalar</h1>
          <p className="text-muted-foreground mt-1">Periyodik workflow çalıştırma zamanlamaları</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Zamanlama
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">
            {isEdit ? 'Zamanlama Düzenle' : 'Yeni Zamanlama'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Workflow *</label>
                <select
                  value={form.workflow_id}
                  onChange={(e) => setForm((f) => ({ ...f, workflow_id: e.target.value }))}
                  required
                  disabled={isEdit}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">-- Workflow seç --</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {isEdit && (
                  <p className="text-xs text-muted-foreground mt-1">Workflow düzenlemede değiştirilemez</p>
                )}
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

            <CronBuilder
              value={form.cron_expression}
              onChange={(cron) => setForm((f) => ({ ...f, cron_expression: cron }))}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
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
                          onClick={() => handleEdit(schedule)}
                          title="Düzenle"
                          className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
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
