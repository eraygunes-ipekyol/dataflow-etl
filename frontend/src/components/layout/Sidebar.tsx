import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  GitBranch,
  Activity,
  Clock,
  GitMerge,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/connections', label: 'Bağlantılar', icon: Database },
  { to: '/workflows', label: 'Workflowlar', icon: GitBranch },
  { to: '/executions', label: 'Çalıştırmalar', icon: Activity },
  { to: '/schedules', label: 'Zamanlamalar', icon: Clock },
  { to: '/orchestrations', label: 'Orkestrasyonlar', icon: GitMerge },
  { to: '/settings', label: 'Ayarlar', icon: Settings },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        sidebarOpen ? 'w-60' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {sidebarOpen && (
          <span className="text-base font-bold tracking-tight">
            <span className="text-primary">Data</span>Flow
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                !sidebarOpen && 'justify-center px-2',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      {sidebarOpen && (
        <div className="border-t border-sidebar-border p-4">
          <p className="text-xs text-muted-foreground">DataFlow ETL v0.1.0</p>
        </div>
      )}
    </aside>
  )
}
