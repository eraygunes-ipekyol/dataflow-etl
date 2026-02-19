import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Pencil,
  Trash2,
  FolderPlus,
  Check,
  X,
  Plus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { FolderTree as FolderTreeType } from '@/types/folder'
import { useUpdateFolder, useDeleteFolder, useCreateFolder } from '@/hooks/useFolders'
import { useUpdateWorkflow, useDeleteWorkflow, useCreateWorkflow } from '@/hooks/useWorkflows'

interface Props {
  tree: FolderTreeType[]
  onFolderSelect?: (folderId: string | undefined) => void
  selectedFolderId?: string
  /** Sürüklenen workflow ID'sini üst bileşene bildirir */
  onDragStart?: (workflowId: string) => void
  onDragEnd?: () => void
  /** Bir klasöre drop yapıldığında tetiklenir */
  onDropToFolder?: (workflowId: string, folderId: string | null) => void
}

export default function FolderTree({
  tree,
  onFolderSelect,
  selectedFolderId,
  onDragStart,
  onDragEnd,
  onDropToFolder,
}: Props) {
  return (
    <div className="space-y-0.5">
      {tree.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          onFolderSelect={onFolderSelect}
          selectedFolderId={selectedFolderId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDropToFolder={onDropToFolder}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────── InlineInput ─────────────────────────── */
function InlineInput({
  defaultValue,
  onConfirm,
  onCancel,
  placeholder,
}: {
  defaultValue?: string
  onConfirm: (val: string) => void
  onCancel: () => void
  placeholder?: string
}) {
  const [val, setVal] = useState(defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const trimmed = val.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 rounded border border-primary bg-background px-2 py-0.5 text-sm focus:outline-none"
      />
      <button onClick={submit} className="flex-shrink-0 rounded p-0.5 hover:bg-green-600/20 text-green-500">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={onCancel} className="flex-shrink-0 rounded p-0.5 hover:bg-red-600/20 text-red-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ─────────────────────────── FolderNode ─────────────────────────── */
function FolderNode({
  folder,
  onFolderSelect,
  selectedFolderId,
  level = 0,
  onDragStart,
  onDragEnd,
  onDropToFolder,
}: {
  folder: FolderTreeType
  onFolderSelect?: (folderId: string | undefined) => void
  selectedFolderId?: string
  level?: number
  onDragStart?: (workflowId: string) => void
  onDragEnd?: () => void
  onDropToFolder?: (workflowId: string, folderId: string | null) => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [addingWorkflow, setAddingWorkflow] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const updateFolder = useUpdateFolder()
  const deleteFolder = useDeleteFolder()
  const createFolder = useCreateFolder()
  const createWorkflow = useCreateWorkflow()

  const hasChildren = folder.children.length > 0 || folder.workflows.length > 0

  const handleRename = (newName: string) => {
    updateFolder.mutate({ id: folder.id, data: { name: newName } })
    setRenaming(false)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (
      confirm(
        `"${folder.name}" klasörünü silmek istediğinizden emin misiniz?\nİçindeki alt klasörler de silinir. Workflow'lar silinmez, kök dizine taşınır.`
      )
    ) {
      deleteFolder.mutate(folder.id)
    }
  }

  const handleAddChild = (name: string) => {
    createFolder.mutate({ name, parent_id: folder.id })
    setAddingChild(false)
    setExpanded(true)
  }

  const handleAddWorkflow = async (name: string) => {
    const wf = await createWorkflow.mutateAsync({ name, folder_id: folder.id })
    setAddingWorkflow(false)
    setExpanded(true)
    navigate(`/workflows/${wf.id}`)
  }

  /* ── Drag & Drop hedefi ── */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const workflowId = e.dataTransfer.getData('workflowId')
    if (workflowId) {
      onDropToFolder?.(workflowId, folder.id)
      setExpanded(true)
    }
  }

  return (
    <div>
      {/* Klasör satırı */}
      <div
        className={`group flex items-center gap-1 rounded-lg py-1.5 text-sm cursor-pointer transition-colors
          ${selectedFolderId === folder.id ? 'bg-muted' : 'hover:bg-muted/30'}
          ${dragOver ? 'ring-2 ring-primary bg-primary/10' : ''}
        `}
        style={{ paddingLeft: `${level * 14 + 8}px`, paddingRight: '8px' }}
        onClick={() => {
          if (!renaming) {
            setExpanded(!expanded)
            onFolderSelect?.(folder.id)
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Chevron */}
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {hasChildren || addingChild || addingWorkflow ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </span>

        {/* Klasör ikonu */}
        <span className="flex-shrink-0">
          {expanded ? (
            <FolderOpen className={`h-4 w-4 ${dragOver ? 'text-primary' : 'text-yellow-500'}`} />
          ) : (
            <Folder className={`h-4 w-4 ${dragOver ? 'text-primary' : 'text-yellow-500'}`} />
          )}
        </span>

        {/* İsim veya inline input */}
        {renaming ? (
          <InlineInput
            defaultValue={folder.name}
            onConfirm={handleRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span className="flex-1 font-medium truncate">{folder.name}</span>
            {folder.workflows.length > 0 && (
              <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">
                {folder.workflows.length}
              </span>
            )}
          </>
        )}

        {/* Aksiyon butonları — hover'da görünür */}
        {!renaming && (
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="Bu klasöre workflow ekle"
              onClick={(e) => {
                e.stopPropagation()
                setAddingWorkflow(true)
                setExpanded(true)
              }}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-blue-400"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              title="Alt klasör ekle"
              onClick={(e) => {
                e.stopPropagation()
                setAddingChild(true)
                setExpanded(true)
              }}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              title="Yeniden adlandır"
              onClick={(e) => {
                e.stopPropagation()
                setRenaming(true)
              }}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              title="Klasörü sil"
              onClick={handleDelete}
              className="rounded p-1 hover:bg-red-600/20 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Alt içerik */}
      {expanded && (
        <div>
          {/* Yeni alt klasör input'u */}
          {addingChild && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 8}px`, paddingRight: '8px' }}
              className="flex items-center gap-2 py-1.5"
            >
              <span className="flex-shrink-0 w-4" />
              <FolderPlus className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <InlineInput
                placeholder="Klasör adı"
                onConfirm={handleAddChild}
                onCancel={() => setAddingChild(false)}
              />
            </div>
          )}

          {/* Yeni workflow input'u */}
          {addingWorkflow && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 8}px`, paddingRight: '8px' }}
              className="flex items-center gap-2 py-1.5"
            >
              <span className="flex-shrink-0 w-4" />
              <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <InlineInput
                placeholder="Workflow adı"
                onConfirm={handleAddWorkflow}
                onCancel={() => setAddingWorkflow(false)}
              />
            </div>
          )}

          {/* Alt klasörler */}
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              onFolderSelect={onFolderSelect}
              selectedFolderId={selectedFolderId}
              level={level + 1}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropToFolder={onDropToFolder}
            />
          ))}

          {/* Klasör içindeki workflow'lar */}
          {folder.workflows.map((workflow) => (
            <WorkflowRow
              key={workflow.id}
              workflow={workflow}
              level={level + 1}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── WorkflowRow ─────────────────────────── */
function WorkflowRow({
  workflow,
  level,
  onDragStart,
  onDragEnd,
}: {
  workflow: { id: string; name: string; is_active: boolean }
  level: number
  onDragStart?: (workflowId: string) => void
  onDragEnd?: () => void
}) {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [dragging, setDragging] = useState(false)
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()

  const handleRename = (newName: string) => {
    updateWorkflow.mutate({ id: workflow.id, data: { name: newName } })
    setRenaming(false)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`"${workflow.name}" workflow'unu silmek istediğinizden emin misiniz?`)) {
      deleteWorkflow.mutate(workflow.id)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('workflowId', workflow.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
    onDragStart?.(workflow.id)
  }

  const handleDragEnd = () => {
    setDragging(false)
    onDragEnd?.()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group flex items-center gap-2 rounded-lg py-1.5 text-sm hover:bg-muted/30 transition-colors cursor-pointer
        ${dragging ? 'opacity-40' : ''}
      `}
      style={{ paddingLeft: `${level * 14 + 8}px`, paddingRight: '8px' }}
      onClick={() => {
        if (!renaming) navigate(`/workflows/${workflow.id}`)
      }}
    >
      <span className="flex-shrink-0 w-4 flex items-center justify-center">
        {/* sürükleme tutamacı */}
        <span className="text-muted-foreground/30 group-hover:text-muted-foreground/60 cursor-grab text-xs select-none">⠿</span>
      </span>
      <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />

      {renaming ? (
        <InlineInput
          defaultValue={workflow.name}
          onConfirm={handleRename}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <span className="flex-1 truncate">{workflow.name}</span>
          {!workflow.is_active && (
            <span className="text-xs text-muted-foreground flex-shrink-0">(pasif)</span>
          )}
          {/* Aksiyon butonları */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              title="Yeniden adlandır"
              onClick={(e) => { e.stopPropagation(); setRenaming(true) }}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              title="Workflow'u sil"
              onClick={handleDelete}
              className="rounded p-1 hover:bg-red-600/20 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
