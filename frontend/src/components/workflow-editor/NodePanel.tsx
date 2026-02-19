import {
  Database,
  ArrowRight,
  Zap,
  Filter,
  Merge,
  GitBranch,
  Terminal,
} from 'lucide-react'

interface Props {
  onAddNode: (type: string) => void
}

const nodeTypes = [
  { type: 'source', label: 'Source', icon: Database, color: 'text-blue-500' },
  {
    type: 'destination',
    label: 'Destination',
    icon: ArrowRight,
    color: 'text-green-500',
  },
  { type: 'transform', label: 'Transform', icon: Zap, color: 'text-yellow-500' },
  { type: 'filter', label: 'Filter', icon: Filter, color: 'text-purple-500' },
  { type: 'join', label: 'Join', icon: Merge, color: 'text-pink-500' },
  {
    type: 'workflowRef',
    label: 'Workflow Ref',
    icon: GitBranch,
    color: 'text-orange-500',
  },
  {
    type: 'sqlExecute',
    label: 'SQL Execute',
    icon: Terminal,
    color: 'text-rose-500',
  },
]

export default function NodePanel({ onAddNode }: Props) {
  return (
    <div className="w-64 border-r border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Node Türleri</h3>
      <div className="space-y-2">
        {nodeTypes.map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => onAddNode(type)}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm hover:bg-accent transition-colors"
          >
            <Icon className={`h-4 w-4 ${color}`} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
