import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from 'reactflow'
import type { EdgeProps } from 'reactflow'
import { X } from 'lucide-react'

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps) {
  const { setEdges } = useReactFlow()

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEdges((eds) => eds.filter((edge) => edge.id !== id))
  }

  // hovered bilgisi WorkflowEditor'dan data prop'u üzerinden gelir
  const showBtn = selected || data?.hovered

  return (
    <>
      {/* Gerçek görsel çizgi */}
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={handleDelete}
            title="Bağlantıyı Kes"
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-600 border border-red-400 text-white shadow-lg transition-all duration-150 hover:bg-red-500 hover:scale-110"
            style={{
              opacity: showBtn ? 1 : 0,
              pointerEvents: showBtn ? 'all' : 'none',
              transition: 'opacity 0.15s ease',
            }}
          >
            <X className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
