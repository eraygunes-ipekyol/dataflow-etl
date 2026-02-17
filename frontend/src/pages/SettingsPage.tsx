import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-muted-foreground mt-1">Uygulama yapılandırması</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Genel</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Ayarlar sayfası yakında kullanıma sunulacak.
        </p>
      </div>
    </div>
  )
}
