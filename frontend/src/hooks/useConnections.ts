import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnectionById,
  testConnectionConfig,
  getSchemas,
  getTables,
  getColumns,
} from '@/api/connections'
import type { ConnectionCreate, ConnectionUpdate } from '@/types/connection'
import { toast } from 'sonner'

const CONNECTIONS_KEY = ['connections']

export function useConnections() {
  return useQuery({
    queryKey: CONNECTIONS_KEY,
    queryFn: getConnections,
  })
}

export function useConnection(id: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, id],
    queryFn: () => getConnection(id),
    enabled: !!id,
  })
}

export function useCreateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConnectionCreate) => createConnection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONNECTIONS_KEY })
      toast.success('Bağlantı oluşturuldu')
    },
    onError: () => {
      toast.error('Bağlantı oluşturulamadı')
    },
  })
}

export function useUpdateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConnectionUpdate }) =>
      updateConnection(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONNECTIONS_KEY })
      toast.success('Bağlantı güncellendi')
    },
    onError: () => {
      toast.error('Bağlantı güncellenemedi')
    },
  })
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteConnection(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONNECTIONS_KEY })
      toast.success('Bağlantı silindi')
    },
    onError: () => {
      toast.error('Bağlantı silinemedi')
    },
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) => testConnectionById(id),
  })
}

export function useTestConnectionConfig() {
  return useMutation({
    mutationFn: (data: ConnectionCreate) => testConnectionConfig(data),
  })
}

export function useSchemas(connectionId: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, connectionId, 'schemas'],
    queryFn: () => getSchemas(connectionId),
    enabled: !!connectionId,
  })
}

export function useTables(connectionId: string, schema: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, connectionId, 'tables', schema],
    queryFn: () => getTables(connectionId, schema),
    enabled: !!connectionId && !!schema,
  })
}

export function useColumns(connectionId: string, table: string, schema: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, connectionId, 'columns', schema, table],
    queryFn: () => getColumns(connectionId, table, schema),
    enabled: !!connectionId && !!table && !!schema,
  })
}
