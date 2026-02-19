import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, KeyRound, LogOut, Monitor, Moon, Settings, ShieldCheck, Sun, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useLogout, useChangePassword } from '@/hooks/useAuth'
import { useUIStore, type ThemeMode } from '@/stores/uiStore'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/connections': 'Bağlantılar',
  '/workflows': 'Workflowlar',
  '/executions': 'Çalıştırmalar',
  '/schedules': 'Zamanlamalar',
  '/orchestrations': 'Orkestrasyonlar',
  '/settings': 'Ayarlar',
}

interface ChangePasswordModalProps {
  onClose: () => void
}

function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const changePw = useChangePassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return
    changePw.mutate(
      { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold mb-4">Şifre Değiştir</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mevcut Şifre</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Yeni Şifre</label>
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
            <label className="text-xs font-medium text-muted-foreground">Yeni Şifre (Tekrar)</label>
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

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Açık', icon: Sun },
  { value: 'dark', label: 'Koyu', icon: Moon },
  { value: 'system', label: 'Sistem', icon: Monitor },
]

function ThemeSelector() {
  const { theme, setTheme } = useUIStore()
  return (
    <div className="px-3 py-2 border-b border-border">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">Tema</p>
      <div className="flex gap-1">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors ${
              theme === value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useUIStore()

  const currentIndex = THEME_OPTIONS.findIndex((o) => o.value === theme)
  const nextOption = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length]
  const CurrentIcon = THEME_OPTIONS[currentIndex]?.icon ?? Moon

  return (
    <button
      onClick={() => setTheme(nextOption.value)}
      title={`Tema: ${THEME_OPTIONS[currentIndex]?.label} → ${nextOption.label}`}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <CurrentIcon className="h-4 w-4" />
    </button>
  )
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  const title = pageTitles[location.pathname] || 'DataFlow ETL'

  // Dropdown açıldığında butonun konumunu hesapla
  useEffect(() => {
    if (dropdownOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
  }, [dropdownOpen])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>

        <div className="flex items-center gap-1">
          {/* Tema toggle */}
          <ThemeToggle />

          {/* Kullanıcı dropdown butonu */}
          <button
            ref={btnRef}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium">{user?.username}</span>
            {user?.role === 'superadmin' && (
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" title="Superadmin" />
            )}
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* Dropdown — Portal ile body'e taşındı, tüm z-index sorunlarını çözer */}
      {dropdownOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setDropdownOpen(false)}
          />
          {/* Dropdown menu */}
          <div
            className="fixed z-[9999] w-52 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            {/* Kullanıcı bilgisi */}
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {user?.role === 'superadmin' ? 'Süper Admin' : 'Kullanıcı'}
              </p>
            </div>

            {/* Tema seçici */}
            <ThemeSelector />

            <div className="py-1">
              {/* Şifre Değiştir */}
              <button
                onClick={() => { setDropdownOpen(false); setShowChangePw(true) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Şifre Değiştir
              </button>

              {/* Kullanıcı Yönetimi (sadece superadmin) */}
              {user?.role === 'superadmin' && (
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/settings') }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Kullanıcı Yönetimi
                </button>
              )}

              <div className="my-1 border-t border-border" />

              {/* Çıkış */}
              <button
                onClick={() => { setDropdownOpen(false); logout() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-muted transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} />
      )}
    </>
  )
}
