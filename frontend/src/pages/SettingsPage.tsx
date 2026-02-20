import { useState } from 'react'
import {
  Plus,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserX,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  useUsers,
  useCreateUser,
  useChangeUserPassword,
  useSetUserActive,
  useDeleteUser,
} from '@/hooks/useAuth'
import type { UserCreate, UserResponse } from '@/types/auth'
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
