export interface Folder {
  id: string
  name: string
  parent_id?: string
  created_at: string
  updated_at: string
}

export interface FolderCreate {
  name: string
  parent_id?: string
}

export interface FolderUpdate {
  name?: string
  parent_id?: string
}

export interface FolderTree extends Folder {
  children: FolderTree[]
  workflows: Array<{
    id: string
    name: string
    is_active: boolean
  }>
}
