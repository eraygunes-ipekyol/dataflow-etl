import { useEffect, useState } from 'react'
import {
  Bot,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserX,
  XCircle,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  useUsers,
  useCreateUser,
  useChangeUserPassword,
  useSetUserActive,
  useDeleteUser,
} from '@/hooks/useAuth'
import { useAISettings, useUpdateAISettings, useAIProviders, useAITest } from '@/hooks/useAI'
import type { UserCreate, UserResponse } from '@/types/auth'
import type { AISettingsUpdate } from '@/types/ai'
import { fmtDate } from '@/utils/date'
import DatabaseManagement from '@/components/admin/DatabaseManagement'

// ─── Kullanıcı Oluştur Modal ─────────────────────────────────────────────────
interface CreateUserModalProps {
  onClose: () => void
}

function CreateUserModal({ onClose }: CreateUserModalProps) {
  const [form, setForm] = useState<UserCreate>({
    username: '',
    password: '',
    role: 'user',
    email: '',
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const createUser = useCreateUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== confirmPassword) return
    createUser.mutate(
      { ...form, email: form.email || undefined },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold mb-4">Yeni Kullanıcı</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kullanıcı Adı *</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              minLength={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">E-posta</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rol *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'superadmin' | 'user' })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="user">Kullanıcı</option>
              <option value="superadmin">Süper Admin</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Şifre * (min 6 karakter)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Şifre Tekrar *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {confirmPassword && form.password !== confirmPassword && (
              <p className="text-xs text-red-400">Şifreler eşleşmiyor</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={createUser.isPending || form.password !== confirmPassword}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createUser.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Şifre Sıfırla Modal ─────────────────────────────────────────────────────
interface ResetPasswordModalProps {
  user: UserResponse
  onClose: () => void
}

function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const changePw = useChangeUserPassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return
    changePw.mutate(
      { userId: user.id, data: { new_password: newPassword, confirm_password: confirmPassword } },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold mb-1">Şifre Sıfırla</h3>
        <p className="text-xs text-muted-foreground mb-4">{user.username}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Yeni Şifre *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Şifre Tekrar *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400">Şifreler eşleşmiyor</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={changePw.isPending || newPassword !== confirmPassword}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {changePw.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Kullanıcı Yönetimi ──────────────────────────────────────────────────────
function UserManagement() {
  const { data: users = [], isLoading } = useUsers()
  const setActive = useSetUserActive()
  const deleteUser = useDeleteUser()
  const currentUser = useAuthStore((s) => s.user)
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserResponse | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-muted-foreground">Sistem kullanıcılarını yönetin</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Kullanıcı
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Yükleniyor...
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kullanıcı</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Durum</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Oluşturulma</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{u.username}</p>
                        {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'superadmin' ? (
                      <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Süper Admin
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Kullanıcı</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_active
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {u.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {fmtDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Şifre sıfırla */}
                      <button
                        onClick={() => setResetTarget(u)}
                        title="Şifre Sıfırla"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>

                      {/* Aktif/Pasif toggle (kendisi değilse) */}
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setActive.mutate({ userId: u.id, data: { is_active: !u.is_active } })}
                          title={u.is_active ? 'Pasife Al' : 'Aktive Et'}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      )}

                      {/* Sil (kendisi değilse) */}
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          title="Sil"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}

      {/* Silme onayı */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold mb-2">Kullanıcıyı Sil</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Bu kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  deleteUser.mutate(deleteConfirm, { onSuccess: () => setDeleteConfirm(null) })
                }}
                disabled={deleteUser.isPending}
                className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleteUser.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI Yapılandırması (superadmin) ─────────────────────────────────────────
function AIConfiguration() {
  const { data: settings, isLoading } = useAISettings()
  const { data: providers = [] } = useAIProviders()
  const updateSettings = useUpdateAISettings()
  const testAI = useAITest()

  const [form, setForm] = useState<AISettingsUpdate>({
    provider: 'openrouter',
    model: '',
    api_key: '',
    is_enabled: false,
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Mevcut ayarları forma yükle
  useEffect(() => {
    if (settings && !initialized) {
      setForm({
        provider: settings.provider,
        model: settings.model,
        is_enabled: settings.is_enabled,
      })
      setInitialized(true)
    }
  }, [settings, initialized])

  // Seçili provider bilgisi
  const selectedProvider = providers.find((p) => p.id === form.provider)

  const handleProviderChange = (provider: string) => {
    const prov = providers.find((p) => p.id === provider)
    setForm({
      ...form,
      provider,
      model: prov?.models?.[0] || '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: AISettingsUpdate = {
      provider: form.provider,
      model: form.model,
      is_enabled: form.is_enabled,
    }
    // API key sadece girilmişse gönder
    if (form.api_key && form.api_key.trim()) {
      payload.api_key = form.api_key.trim()
    }
    updateSettings.mutate(payload, {
      onSuccess: () => {
        setForm((prev) => ({ ...prev, api_key: '' }))
        setShowApiKey(false)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Yükleniyor...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold">AI Yapılandırması</h2>
            <p className="text-sm text-muted-foreground">
              Yapay zeka ile workflow oluşturma ayarları
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* AI Aktif/Pasif Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">AI Özelliği</p>
              <p className="text-xs text-muted-foreground">
                Kullanıcıların AI ile workflow oluşturmasını etkinleştir
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, is_enabled: !form.is_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.is_enabled ? 'bg-emerald-500' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.is_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* LLM Sağlayıcı */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">LLM Sağlayıcı</label>
          <select
            value={form.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Model Seçimi */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          {selectedProvider?.custom_model ? (
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Model adı girin (ör: anthropic/claude-sonnet-4)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : (
            <select
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {selectedProvider?.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={form.api_key || ''}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={settings?.api_key_set ? '••••••••  (mevcut key korunuyor)' : 'API anahtarını girin'}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {settings?.api_key_set && (
            <p className="text-xs text-emerald-400">API key tanımlı. Değiştirmek için yeni key girin.</p>
          )}
        </div>

        {/* Test Sonucu */}
        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 ${
              testResult.success
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            )}
            <p
              className={`text-sm ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {testResult.message}
            </p>
          </div>
        )}

        {/* Test Et & Kaydet */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={testAI.isPending || (!form.api_key?.trim() && !settings?.api_key_set)}
            onClick={() => {
              setTestResult(null)
              const apiKey = form.api_key?.trim() || ''
              if (!apiKey && !settings?.api_key_set) return
              testAI.mutate(
                { provider: form.provider, model: form.model, api_key: apiKey },
                {
                  onSuccess: (data) => setTestResult(data),
                  onError: () =>
                    setTestResult({ success: false, message: 'Test isteği gönderilemedi.' }),
                }
              )
            }}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {testAI.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {testAI.isPending ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
          </button>
          <button
            type="submit"
            disabled={updateSettings.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {updateSettings.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Ana Sayfa ───────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.role === 'superadmin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-muted-foreground mt-1">Hesap ve sistem yapılandırması</p>
      </div>

      {/* Profil Bilgileri */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{user?.username}</p>
            <p className="text-xs text-muted-foreground">
              {user?.role === 'superadmin' ? 'Süper Admin' : 'Kullanıcı'}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Şifrenizi değiştirmek için sağ üstteki kullanıcı menüsünü kullanın.
        </p>
      </div>

      {/* AI Yapılandırması (sadece superadmin) */}
      {isSuperAdmin && (
        <div className="rounded-xl border border-border bg-card p-6">
          <AIConfiguration />
        </div>
      )}

      {/* Kullanıcı Yönetimi (sadece superadmin) */}
      {isSuperAdmin && (
        <div className="rounded-xl border border-border bg-card p-6">
          <UserManagement />
        </div>
      )}

      {/* Veritabanı Yönetimi (sadece superadmin) */}
      {isSuperAdmin && (
        <div className="rounded-xl border border-border bg-card p-6">
          <DatabaseManagement />
        </div>
      )}
    </div>
  )
}
