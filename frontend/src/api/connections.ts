import { api } from './client'
import type {
  Connection,
  ConnectionCreate,
  ConnectionDetail,
  ConnectionTestResult,
  ConnectionUpdate,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from '@/types/connection'
import type { PreviewTableRequest, PreviewQueryRequest, PreviewResponse } from '@/types/dataPreview'

// --- Connections ---

export async function getConnections(): Promise<Connection[]> {
  const { data } = await api.get('/connections')
  return data
}

export async function getConnection(id: string): Promise<ConnectionDetail> {
  const { data } = await api.get(`/connections/${id}`)
  return data
}

export async function createConnection(payload: ConnectionCreate): Promise<Connection> {
  const { data } = await api.post('/connections', payload)
  return data
}

export async function updateConnection(id: string, payload: ConnectionUpdate): Promise<Connection> {
  const { data } = await api.put(`/connections/${id}`, payload)
  return data
}

export async function deleteConnection(id: string): Promise<void> {
  await api.delete(`/connections/${id}`)
}

export async function testConnectionById(id: string): Promise<ConnectionTestResult> {
  const { data } = await api.post(`/connections/${id}/test`)
  return data
}

export async function testConnectionConfig(payload: ConnectionCreate): Promise<ConnectionTestResult> {
  const { data } = await api.post('/connections/test', payload)
  return data
}

// --- Schemas / Tables / Columns ---

export async function getSchemas(connectionId: string): Promise<SchemaInfo[]> {
  const { data } = await api.get(`/connections/${connectionId}/schemas`)
  return data
}

export async function getTables(connectionId: string, schema: string): Promise<TableInfo[]> {
  const { data } = await api.get(`/connections/${connectionId}/tables`, {
    params: { schema },
  })
  return data
}

export async function getColumns(connectionId: string, table: string, schema: string): Promise<ColumnInfo[]> {
  const { data } = await api.get(`/connections/${connectionId}/tables/${table}/columns`, {
    params: { schema },
  })
  return data
}

// --- Preview ---

export async function previewTable(payload: PreviewTableRequest): Promise<PreviewResponse> {
  const { data } = await api.post('/preview/table', payload)
  return data
}

export async function previewQuery(payload: PreviewQueryRequest): Promise<PreviewResponse> {
  const { data } = await api.post('/preview/query', payload)
  return data
}

/** SQL sorgusunun kolon listesini çeker (veri satırı döndürmez — mapping için hızlı yükleme) */
export async function getQueryColumns(
  connectionId: string,
  query: string,
): Promise<ColumnInfo[]> {
  const { data } = await api.post('/preview/columns', { connection_id: connectionId, query })
  return data
}
