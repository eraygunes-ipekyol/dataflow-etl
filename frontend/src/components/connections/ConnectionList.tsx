import { Database, MoreVertical, Trash2, Plug, PlugZap } from 'lucide-react'
import { useState } from 'react'
import type { Connection } from '@/types/connection'
import { useDeleteConnection, useTestConnection } from '@/hooks/useConnections'
import { toast } from 'sonner'

interface Props {
  connections: Connection[]
}

export default function ConnectionList({ connections }: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const deleteMutation = useDeleteConnection()
  const testMutation = useTestConnection()

  const handleTest = (id: string) => {
    testMutation.mutate(id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success(result.message)
        } else {
          toast.error(result.message)
        }
      },
    })
    setMenuOpenId(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('Bu bağlantıyı silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
    setMenuOpenId(null)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="relative rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
        >
          {/* Type icon + name */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${conn.type === 'mssql' ? 'bg-blue-500/10' : 'bg-yellow-500/10'}`}>
                <Database className={`h-5 w-5 ${conn.type === 'mssql' ? 'text-blue-400' : 'text-yellow-400'}`} />
              </div>
              <div>
                <h3 className="font-medium text-sm">{conn.name}</h3>
                <p className="text-xs text-muted-foreground uppercase mt-0.5">
                  {conn.type === 'mssql' ? 'MSSQL' : 'BigQuery'}
                </p>
              </div>
            </div>

            {/* Menu button */}
            <div className="relative">
              <button
                onClick={() => setMenuOpenId(menuOpenId === conn.id ? null : conn.id)}
                className="rounded-md p-1 hover:bg-accent transition-colors"
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>

              {menuOpenId === conn.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                  <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-border bg-popover py-1 shadow-xl">
                    <button
                      onClick={() => handleTest(conn.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <PlugZap className="h-4 w-4" />
                      Bağlantıyı Test Et
                    </button>
                    <button
                      onClick={() => handleDelete(conn.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="mt-4 flex items-center gap-2">
            <Plug className={`h-3 w-3 ${conn.is_active ? 'text-success' : 'text-muted-foreground'}`} />
            <span className={`text-xs ${conn.is_active ? 'text-success' : 'text-muted-foreground'}`}>
              {conn.is_active ? 'Aktif' : 'Pasif'}
            </span>
          </div>

          {/* Created date */}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(conn.created_at).toLocaleDateString('tr-TR')}
          </p>
        </div>
      ))}
    </div>
  )
}
