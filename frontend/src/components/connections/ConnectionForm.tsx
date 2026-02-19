import { useState } from 'react'
import { X } from 'lucide-react'
import type {
  ConnectionType,
  ConnectionCreate,
  ConnectionTestResult,
  MssqlConfig,
  BigQueryConfig,
} from '@/types/connection'
import MssqlConnectionFields from './MssqlConnectionFields'
import BigQueryConnectionFields from './BigQueryConnectionFields'
import ConnectionTestButton from './ConnectionTestButton'
import { useCreateConnection, useTestConnectionConfig } from '@/hooks/useConnections'

const defaultMssqlConfig: MssqlConfig = {
  host: '',
  port: 1433,
  database: '',
  username: '',
  password: '',
}

const defaultBigQueryConfig: BigQueryConfig = {
  project_id: '',
  dataset: '',
  credentials_json: '',
}

interface Props {
  onClose: () => void
}

export default function ConnectionForm({ onClose }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ConnectionType>('mssql')
  const [mssqlConfig, setMssqlConfig] = useState<MssqlConfig>(defaultMssqlConfig)
  const [bigqueryConfig, setBigqueryConfig] = useState<BigQueryConfig>(defaultBigQueryConfig)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)

  const createMutation = useCreateConnection()
  const testMutation = useTestConnectionConfig()

  const currentConfig = type === 'mssql' ? mssqlConfig : bigqueryConfig

  const handleTest = () => {
    setTestResult(null)
    testMutation.mutate(
      { name, type, config: currentConfig },
      { onSuccess: (result) => setTestResult(result) },
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(
      { name, type, config: currentConfig } as ConnectionCreate,
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Yeni Bağlantı</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Bağlantı Adı */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Bağlantı Adı
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Production MSSQL"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Bağlantı Tipi */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Bağlantı Tipi
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setType('mssql'); setTestResult(null) }}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  type === 'mssql'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                MSSQL
              </button>
              <button
                type="button"
                onClick={() => { setType('bigquery'); setTestResult(null) }}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  type === 'bigquery'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                Google BigQuery
              </button>
            </div>
          </div>

          {/* Tip'e göre config alanları */}
          {type === 'mssql' ? (
            <MssqlConnectionFields config={mssqlConfig} onChange={setMssqlConfig} />
          ) : (
            <BigQueryConnectionFields config={bigqueryConfig} onChange={setBigqueryConfig} />
          )}

          {/* Test butonu */}
          <ConnectionTestButton
            onTest={handleTest}
            isLoading={testMutation.isPending}
            result={testResult}
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
