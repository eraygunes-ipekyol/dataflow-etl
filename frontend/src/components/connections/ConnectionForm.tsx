import { useState } from 'react'
import { X } from 'lucide-react'
import type {
  ConnectionType,
  ConnectionCreate,
  ConnectionUpdate,
  ConnectionDetail,
  ConnectionTestResult,
  MssqlConfig,
  BigQueryConfig,
} from '@/types/connection'
import MssqlConnectionFields from './MssqlConnectionFields'
import BigQueryConnectionFields from './BigQueryConnectionFields'
import ConnectionTestButton from './ConnectionTestButton'
import { useCreateConnection, useUpdateConnection, useTestConnectionConfig } from '@/hooks/useConnections'

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
  initialData?: ConnectionDetail
  connectionId?: string
}

export default function ConnectionForm({ onClose, initialData, connectionId }: Props) {
  const isEdit = !!connectionId

  // Edit modunda config'i başlangıç değeri olarak doldur (şifre/credentials boş bırakılır)
  const initMssql = (): MssqlConfig => {
    if (isEdit && initialData?.config) {
      const c = initialData.config as Record<string, unknown>
      return {
        host: (c.host as string) ?? '',
        port: (c.port as number) ?? 1433,
        database: (c.database as string) ?? '',
        username: (c.username as string) ?? '',
        password: '', // backend maskeliyor, boş bırak
      }
    }
    return defaultMssqlConfig
  }

  const initBigQuery = (): BigQueryConfig => {
    if (isEdit && initialData?.config) {
      const c = initialData.config as Record<string, unknown>
      return {
        project_id: (c.project_id as string) ?? '',
        dataset: (c.dataset as string) ?? '',
        credentials_json: '', // backend maskeliyor, boş bırak
      }
    }
    return defaultBigQueryConfig
  }

  const [name, setName] = useState(initialData?.name ?? '')
  const [type, setType] = useState<ConnectionType>(initialData?.type ?? 'mssql')
  const [mssqlConfig, setMssqlConfig] = useState<MssqlConfig>(initMssql)
  const [bigqueryConfig, setBigqueryConfig] = useState<BigQueryConfig>(initBigQuery)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)

  const createMutation = useCreateConnection()
  const updateMutation = useUpdateConnection()
  const testMutation = useTestConnectionConfig()

  const currentConfig = type === 'mssql' ? mssqlConfig : bigqueryConfig
  const isSaving = isEdit ? updateMutation.isPending : createMutation.isPending

  const handleTest = () => {
    setTestResult(null)
    testMutation.mutate(
      { name, type, config: currentConfig },
      { onSuccess: (result) => setTestResult(result) },
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEdit) {
      // Edit modunda: şifre/credentials boşsa payload'a ekleme (mevcut değeri koru)
      let config: Record<string, unknown>
      if (type === 'mssql') {
        config = {
          host: mssqlConfig.host,
          port: mssqlConfig.port,
          database: mssqlConfig.database,
          username: mssqlConfig.username,
        }
        if (mssqlConfig.password) config.password = mssqlConfig.password
      } else {
        config = {
          project_id: bigqueryConfig.project_id,
          dataset: bigqueryConfig.dataset,
        }
        if (bigqueryConfig.credentials_json) config.credentials_json = bigqueryConfig.credentials_json
      }

      const payload: ConnectionUpdate = { name, config: config as unknown as MssqlConfig }
      updateMutation.mutate(
        { id: connectionId, data: payload },
        { onSuccess: () => onClose() },
      )
    } else {
      createMutation.mutate(
        { name, type, config: currentConfig } as ConnectionCreate,
        { onSuccess: () => onClose() },
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Bağlantıyı Düzenle' : 'Yeni Bağlantı'}
          </h2>
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
                disabled={isEdit}
                onClick={() => !isEdit && setType('mssql')}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  type === 'mssql'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                } ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                MSSQL
              </button>
              <button
                type="button"
                disabled={isEdit}
                onClick={() => !isEdit && setType('bigquery')}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  type === 'bigquery'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                } ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Google BigQuery
              </button>
            </div>
            {isEdit && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Bağlantı tipi değiştirilemez.
              </p>
            )}
          </div>

          {/* Tip'e göre config alanları */}
          {type === 'mssql' ? (
            <MssqlConnectionFields
              config={mssqlConfig}
              onChange={setMssqlConfig}
              isEdit={isEdit}
            />
          ) : (
            <BigQueryConnectionFields config={bigqueryConfig} onChange={setBigqueryConfig} isEdit={isEdit} />
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
              disabled={isSaving || !name}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? (isEdit ? 'Güncelleniyor...' : 'Kaydediliyor...') : (isEdit ? 'Güncelle' : 'Kaydet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
