import type { MssqlConfig } from '@/types/connection'

interface Props {
  config: MssqlConfig
  onChange: (config: MssqlConfig) => void
}

export default function MssqlConnectionFields({ config, onChange }: Props) {
  const update = (field: keyof MssqlConfig, value: string | number) => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Sunucu Adresi
          </label>
          <input
            type="text"
            value={config.host}
            onChange={(e) => update('host', e.target.value)}
            placeholder="localhost veya IP adresi"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Port
          </label>
          <input
            type="number"
            value={config.port}
            onChange={(e) => update('port', parseInt(e.target.value) || 1433)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Veritabanı
        </label>
        <input
          type="text"
          value={config.database}
          onChange={(e) => update('database', e.target.value)}
          placeholder="Veritabanı adı"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Kullanıcı Adı
          </label>
          <input
            type="text"
            value={config.username}
            onChange={(e) => update('username', e.target.value)}
            placeholder="sa"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            Şifre
          </label>
          <input
            type="password"
            value={config.password}
            onChange={(e) => update('password', e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  )
}
