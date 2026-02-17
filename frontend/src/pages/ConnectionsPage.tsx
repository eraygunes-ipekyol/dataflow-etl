import { useState } from 'react'
import { Database, Plus, Loader2 } from 'lucide-react'
import { useConnections } from '@/hooks/useConnections'
import ConnectionList from '@/components/connections/ConnectionList'
import ConnectionForm from '@/components/connections/ConnectionForm'

export default function ConnectionsPage() {
  const [showForm, setShowForm] = useState(false)
  const { data: connections, isLoading } = useConnections()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bağlantılar</h1>
          <p className="text-muted-foreground mt-1">Veritabanı bağlantılarını yönetin</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Bağlantı
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : connections && connections.length > 0 ? (
        <ConnectionList connections={connections} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Database className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Bağlantı bulunamadı</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            MSSQL veya BigQuery bağlantısı ekleyerek başlayın.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Bağlantı Ekle
          </button>
        </div>
      )}

      {showForm && <ConnectionForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
