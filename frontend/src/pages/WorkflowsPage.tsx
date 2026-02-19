import { useState, useRef, useEffect } from 'react'
import {
  Plus,
  Upload,
  FileText,
  FolderOpen,
  Clock,
  ChevronRight,
  FolderPlus,
  Pencil,
  Check,
  X,
  Trash2,
  Search,
  ChevronRight as BreadArrow,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFolderTree, useCreateFolder } from '@/hooks/useFolders'
import {
  useWorkflows,
  useCreateWorkflow,
  useImportWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
} from '@/hooks/useWorkflows'
import FolderTree from '@/components/workflows/FolderTree'
import WorkflowCreateDialog from '@/components/workflows/WorkflowCreateDialog'
import WorkflowImportDialog from '@/components/workflows/WorkflowImportDialog'
import type { FolderTree as FolderTreeType } from '@/types/folder'
import type { Workflow } from '@/types/workflow'
import { fmtDateTime } from '@/utils/date'

/* ─────────────── Yardımcı fonksiyonlar ─────────────── */
function formatDate(dateStr: string) {
  return fmtDateTime(dateStr)
}

/** Klasör ağacında tüm workflow'ları düzleştir ve breadcrumb yolunu hesapla */
interface FlatWorkflow {
  id: string
  name: string
  is_active: boolean
  folder_id?: string
  path: string[]   // ['Klasör A', 'Alt Klasör B']
}

function flattenTree(tree: FolderTreeType[], ancestors: string[] = []): FlatWorkflow[] {
  const result: FlatWorkflow[] = []
  for (const folder of tree) {
    const currentPath = [...ancestors, folder.name]
    for (const wf of folder.workflows) {
      result.push({ ...wf, folder_id: folder.id, path: currentPath })
    }
    result.push(...flattenTree(folder.children, currentPath))
  }
  return result
}

/* ─────────────── InlineRenameInput ─────────────── */
function InlineRenameInput({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  defaultValue: string
  onConfirm: (val: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const trimmed = val.trim()
    if (trimmed && trimmed !== defaultValue) onConfirm(trimmed)
    else onCancel()
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 min-w-0 rounded-lg border border-primary bg-background px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button onClick={submit} className="flex-shrink-0 rounded-lg p-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-500">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={onCancel} className="flex-shrink-0 rounded-lg p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ─────────────── RootFolderInput ─────────────── */
function RootFolderInput({
  onConfirm, onCancel,
}: { onConfirm: (val: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const submit = () => { const t = val.trim(); if (t) onConfirm(t); else onCancel() }
  return (
    <>
      <input
        ref={inputRef} value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Klasör adı"
        className="flex-1 min-w-0 rounded border border-primary bg-background px-2 py-0.5 text-sm focus:outline-none"
      />
      <button onClick={submit} className="flex-shrink-0 rounded p-0.5 hover:bg-green-600/20 text-green-500"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel} className="flex-shrink-0 rounded p-0.5 hover:bg-red-600/20 text-red-500"><X className="h-3.5 w-3.5" /></button>
    </>
  )
}

/* ─────────────── SearchBar ─────────────── */
function SearchBar({
  allWorkflows,
  folderWorkflows,
  onClose,
}: {
  allWorkflows: Workflow[]
  folderWorkflows: FlatWorkflow[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Kök workflow'lar (folder_id yok)
  const rootFlat: FlatWorkflow[] = allWorkflows
    .filter((w) => !w.folder_id)
    .map((w) => ({ id: w.id, name: w.name, is_active: w.is_active, path: [] }))

  const allFlat = [...rootFlat, ...folderWorkflows]

  const q = query.trim().toLowerCase()
  const results = q
    ? allFlat.filter((w) => w.name.toLowerCase().includes(q))
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input alanı */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
            placeholder="Workflow ara..."
            className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sonuçlar */}
        <div className="max-h-96 overflow-y-auto">
          {q === '' && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Workflow adı yazarak arayın
            </div>
          )}
          {q !== '' && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>"{query}" ile eşleşen workflow bulunamadı</p>
            </div>
          )}
          {results.map((wf) => (
            <button
              key={wf.id}
              onClick={() => { navigate(`/workflows/${wf.id}`); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {/* İsimde eşleşen kısmı vurgula */}
                <HighlightedName name={wf.name} query={q} />
                {/* Breadcrumb yolu */}
                {wf.path.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {wf.path.map((seg, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <BreadArrow className="h-3 w-3 text-muted-foreground/50" />}
                        <span className="text-xs text-muted-foreground">{seg}</span>
                      </span>
                    ))}
                  </div>
                )}
                {wf.path.length === 0 && (
                  <span className="text-xs text-muted-foreground">Kök dizin</span>
                )}
              </div>
              {!wf.is_active && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 flex-shrink-0">pasif</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            </button>
          ))}
        </div>

        {q !== '' && results.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
            {results.length} sonuç bulundu
          </div>
        )}
      </div>
    </div>
  )
}

/** Arama sorgusunu vurgulayan metin bileşeni */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span className="text-sm font-medium">{name}</span>
  return (
    <span className="text-sm font-medium">
      {name.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded px-0.5">{name.slice(idx, idx + query.length)}</mark>
      {name.slice(idx + query.length)}
    </span>
  )
}

/* ─────────────── Ana sayfa ─────────────── */
export default function WorkflowsPage() {
  const navigate = useNavigate()
  const { data: folderTree } = useFolderTree()
  const { data: allWorkflows } = useWorkflows()
  const createWorkflow = useCreateWorkflow()
  const importWorkflow = useImportWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const createFolder = useCreateFolder()

  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>()
  const [addingRootFolder, setAddingRootFolder] = useState(false)
  const [renamingWorkflowId, setRenamingWorkflowId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [rootDropOver, setRootDropOver] = useState(false)

  // Ctrl+K / Cmd+K → arama aç
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCreate = async (name: string, description?: string) => {
    const wf = await createWorkflow.mutateAsync({ name, description, folder_id: selectedFolderId })
    setCreateOpen(false)
    navigate(`/workflows/${wf.id}`)
  }

  const handleImport = async (file: File) => {
    await importWorkflow.mutateAsync({ file, folderId: selectedFolderId })
    setImportOpen(false)
  }

  const handleRenameWorkflow = (id: string, newName: string) => {
    updateWorkflow.mutate({ id, data: { name: newName } })
    setRenamingWorkflowId(null)
  }

  const handleDeleteWorkflow = (wf: Workflow) => {
    if (confirm(`"${wf.name}" workflow'unu silmek istediğinizden emin misiniz?`)) {
      deleteWorkflow.mutate(wf.id)
    }
  }

  const handleCreateRootFolder = (name: string) => {
    createFolder.mutate({ name, parent_id: undefined })
    setAddingRootFolder(false)
  }

  /** Bir workflow'u klasöre taşı (folderId=null → kök dizine çıkar) */
  const handleDropToFolder = (workflowId: string, folderId: string | null) => {
    updateWorkflow.mutate({
      id: workflowId,
      data: { folder_id: folderId ?? undefined },
    })
  }

  /* Root drop alanı — klasörden çıkarıp kök dizine bırak */
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setRootDropOver(true)
  }
  const handleRootDragLeave = () => setRootDropOver(false)
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setRootDropOver(false)
    const workflowId = e.dataTransfer.getData('workflowId')
    if (workflowId) handleDropToFolder(workflowId, null)
  }

  const rootWorkflows = allWorkflows?.filter((w) => !w.folder_id) ?? []
  const hasFolders = folderTree && folderTree.length > 0
  const folderWorkflows = folderTree ? flattenTree(folderTree) : []

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-sm text-muted-foreground mt-1">ETL süreçlerinizi tasarlayın ve yönetin</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Arama butonu */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Search className="h-4 w-4" />
              Ara
              <span className="ml-1 text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">⌘K</span>
            </button>
            <button
              onClick={() => setAddingRootFolder(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              Yeni Klasör
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Upload className="h-4 w-4" />
              İçe Aktar
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Yeni Workflow
            </button>
          </div>
        </div>
      </div>

      {/* ── İçerik ── */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Klasörler */}
        {(hasFolders || addingRootFolder) && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Klasörler</h2>
            </div>
            <div className="rounded-lg border border-border bg-card p-2">
              {addingRootFolder && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <FolderPlus className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <RootFolderInput onConfirm={handleCreateRootFolder} onCancel={() => setAddingRootFolder(false)} />
                  </div>
                </div>
              )}
              {folderTree && (
                <FolderTree
                  tree={folderTree}
                  onFolderSelect={setSelectedFolderId}
                  selectedFolderId={selectedFolderId}
                  onDropToFolder={handleDropToFolder}
                />
              )}
            </div>
          </div>
        )}

        {/* Kök workflow listesi */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Workflowlar</h2>
            {rootWorkflows.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{rootWorkflows.length}</span>
            )}
          </div>

          {/* Root drop hedefi — sürükleyip bırakınca kök dizine taşır */}
          <div
            onDragOver={handleRootDragOver}
            onDragLeave={handleRootDragLeave}
            onDrop={handleRootDrop}
            className={`rounded-lg transition-all min-h-[60px] ${rootDropOver ? 'ring-2 ring-primary bg-primary/5 p-1' : ''}`}
          >
            {rootDropOver && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-primary font-medium">
                <FileText className="h-4 w-4" />
                Kök dizine bırak
              </div>
            )}

            {!rootDropOver && rootWorkflows.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Henüz workflow yok</p>
                <p className="text-xs text-muted-foreground/60 mb-4">ETL sürecini başlatmak için yeni bir workflow oluşturun</p>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  İlk Workflow'u Oluştur
                </button>
              </div>
            )}

            {!rootDropOver && rootWorkflows.length > 0 && (
              <div className="grid gap-2">
                {rootWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    renaming={renamingWorkflowId === workflow.id}
                    onRenameStart={() => setRenamingWorkflowId(workflow.id)}
                    onRenameConfirm={(name) => handleRenameWorkflow(workflow.id, name)}
                    onRenameCancel={() => setRenamingWorkflowId(null)}
                    onDelete={() => handleDeleteWorkflow(workflow)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Diyaloglar ── */}
      <WorkflowCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} isLoading={createWorkflow.isPending} />
      <WorkflowImportDialog open={importOpen} onOpenChange={setImportOpen} onSubmit={handleImport} isLoading={importWorkflow.isPending} />

      {/* ── Arama modal'ı ── */}
      {searchOpen && (
        <SearchBar
          allWorkflows={allWorkflows ?? []}
          folderWorkflows={folderWorkflows}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}

/* ─────────────── WorkflowCard ─────────────── */
function WorkflowCard({
  workflow,
  renaming,
  onRenameStart,
  onRenameConfirm,
  onRenameCancel,
  onDelete,
}: {
  workflow: Workflow
  renaming: boolean
  onRenameStart: () => void
  onRenameConfirm: (name: string) => void
  onRenameCancel: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('workflowId', workflow.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }
  const handleDragEnd = () => setDragging(false)

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3
        hover:bg-accent hover:border-primary/40 transition-all cursor-pointer
        ${dragging ? 'opacity-40' : ''}
      `}
      onClick={() => { if (!renaming) navigate(`/workflows/${workflow.id}`) }}
    >
      {/* Sürükleme tutamacı */}
      <span className="text-muted-foreground/30 group-hover:text-muted-foreground/60 cursor-grab text-sm select-none flex-shrink-0">⠿</span>

      {/* İkon */}
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <FileText className="h-4 w-4 text-primary" />
      </div>

      {/* İsim / Rename */}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <InlineRenameInput
            defaultValue={workflow.name}
            onConfirm={onRenameConfirm}
            onCancel={onRenameCancel}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{workflow.name}</span>
              {!workflow.is_active && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">pasif</span>
              )}
              <span className="text-xs text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 flex-shrink-0">v{workflow.version}</span>
            </div>
            {workflow.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{workflow.description}</p>
            )}
          </>
        )}
      </div>

      {/* Tarih */}
      {!renaming && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3 w-3" />
          <span>{formatDate(workflow.updated_at)}</span>
        </div>
      )}

      {/* Aksiyon butonları */}
      {!renaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            title="Yeniden adlandır"
            onClick={(e) => { e.stopPropagation(); onRenameStart() }}
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            title="Workflow'u sil"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="rounded-lg p-1.5 hover:bg-red-600/20 text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </div>
      )}
    </div>
  )
}
