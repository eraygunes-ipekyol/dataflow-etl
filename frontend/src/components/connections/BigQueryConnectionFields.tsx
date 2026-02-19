import { Upload } from 'lucide-react'
import { useRef } from 'react'
import type { BigQueryConfig } from '@/types/connection'

interface Props {
  config: BigQueryConfig
  onChange: (config: BigQueryConfig) => void
  isEdit?: boolean
}

export default function BigQueryConnectionFields({ config, onChange, isEdit }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = (field: keyof BigQueryConfig, value: string) => {
    onChange({ ...config, [field]: value })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        // JSON olduğunu doğrula
        const parsed = JSON.parse(content)
        onChange({
          ...config,
          credentials_json: content,
          project_id: parsed.project_id || config.project_id,
        })
      } catch {
        // Geçersiz JSON
        alert('Geçersiz JSON dosyası')
      }
    }
    reader.readAsText(file)
  }

  const hasCredentials = config.credentials_json.length > 0

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Google Cloud Proje ID
        </label>
        <input
          type="text"
          value={config.project_id}
          onChange={(e) => update('project_id', e.target.value)}
          placeholder="my-project-id"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Varsayılan Dataset
        </label>
        <input
          type="text"
          value={config.dataset}
          onChange={(e) => update('dataset', e.target.value)}
          placeholder="my_dataset (opsiyonel)"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Service Account JSON Key
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            hasCredentials
              ? 'border-success/50 bg-success/5 text-success'
              : 'border-input hover:border-primary/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="h-5 w-5" />
          {hasCredentials
            ? 'JSON key yüklendi - Değiştirmek için tıklayın'
            : isEdit
              ? 'Değiştirmek için JSON key dosyası yükleyin (boş bırakılırsa mevcut key korunur)'
              : 'JSON key dosyası yükleyin'}
        </button>
      </div>
    </div>
  )
}
