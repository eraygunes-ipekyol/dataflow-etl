import { useState } from 'react'
import { Bell, Send, Loader2, CheckCircle2, XCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { workflowApi } from '@/api/workflows'
import { useUpdateWorkflow } from '@/hooks/useWorkflows'

const DEFAULT_WEBHOOK_URL = 'https://jia.ipk.mobi/webhook/etl-bildirim'

interface Props {
  workflowId: string
  webhookUrl: string | null | undefined
  onFailure: boolean
  onSuccess: boolean
  onClose: () => void
}

export default function NotificationSettings({
  workflowId,
  webhookUrl,
  onFailure,
  onSuccess,
  onClose,
}: Props) {
  const [url, setUrl] = useState(webhookUrl ?? DEFAULT_WEBHOOK_URL)
  const [notifyOnFailure, setNotifyOnFailure] = useState(onFailure)
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(onSuccess)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const updateWorkflow = useUpdateWorkflow()

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: {
          notification_webhook_url: url.trim() || null,
          notification_on_failure: notifyOnFailure,
          notification_on_success: notifyOnSuccess,
        },
      })
      toast.success('Bildirim ayarları kaydedildi')
      onClose()
    } catch {
      toast.error('Ayarlar kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!url.trim()) {
      toast.error('Webhook URL boş olamaz')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      // Önce URL'yi kaydet, sonra test et
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: { notification_webhook_url: url.trim() },
      })
      const result = await workflowApi.testWebhook(workflowId)
      setTestResult('success')
      toast.success('Test webhook başarıyla gönderildi!', {
        description: result.message,
      })
    } catch {
      setTestResult('error')
      toast.error('Test webhook gönderilemedi — URL\'yi kontrol edin')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Bell className="h-5 w-5 text-primary" />
          <span className="font-semibold">Bildirim Ayarları</span>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium mb-1">Webhook URL</label>
            <div className="relative">
              <input
                value={url}
                onChange={(e) => { setUrl(e.target.value); setTestResult(null) }}
                placeholder="https://example.com/webhook"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {testResult === 'success' && (
                <CheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
              {testResult === 'error' && (
                <AlertTriangle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Execution tamamlandığında bu URL'ye JSON POST gönderilir.
            </p>
            {url !== DEFAULT_WEBHOOK_URL && (
              <button
                onClick={() => { setUrl(DEFAULT_WEBHOOK_URL); setTestResult(null) }}
                className="text-xs text-primary hover:underline mt-0.5"
              >
                Varsayılan URL'ye sıfırla
              </button>
            )}
          </div>

          {/* Toggle: Hata bildirimi */}
          <label className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/10 transition-colors">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <span className="text-sm font-medium">Hata durumunda bildir</span>
                <p className="text-xs text-muted-foreground">Execution başarısız olduğunda</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyOnFailure}
              onChange={(e) => setNotifyOnFailure(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
          </label>

          {/* Toggle: Başarı bildirimi */}
          <label className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/10 transition-colors">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <span className="text-sm font-medium">Başarı durumunda bildir</span>
                <p className="text-xs text-muted-foreground">Execution başarılı olduğunda</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyOnSuccess}
              onChange={(e) => setNotifyOnSuccess(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
          </label>

          {/* Test sonucu bilgi kutusu */}
          {testResult && (
            <div className={`rounded-lg p-3 text-xs ${
              testResult === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {testResult === 'success' ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Webhook başarıyla gönderildi. Hedef servisi kontrol edin.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>Webhook gönderilemedi. URL adresini ve hedef servisin erişilebilir olduğunu kontrol edin.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            onClick={handleTest}
            disabled={testing || !url.trim()}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Test Gönder
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
