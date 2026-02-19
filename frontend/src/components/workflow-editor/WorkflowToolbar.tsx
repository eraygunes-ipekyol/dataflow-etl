import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface Props {
  onUndo?: () => void
  onRedo?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
}

export default function WorkflowToolbar({
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
}: Props) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <button
        onClick={onUndo}
        className="p-2 rounded hover:bg-accent transition-colors"
        title="Geri Al"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={onRedo}
        className="p-2 rounded hover:bg-accent transition-colors"
        title="İleri Al"
      >
        <Redo2 className="h-4 w-4" />
      </button>
      <div className="w-px h-6 bg-border mx-1" />
      <button
        onClick={onZoomIn}
        className="p-2 rounded hover:bg-accent transition-colors"
        title="Yakınlaştır"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 rounded hover:bg-accent transition-colors"
        title="Uzaklaştır"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        onClick={onFitView}
        className="p-2 rounded hover:bg-accent transition-colors"
        title="Tümünü Göster"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  )
}
